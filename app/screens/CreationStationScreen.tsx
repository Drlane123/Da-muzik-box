import {
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
import { flushSync, createPortal } from 'react-dom';
import { Send, ZoomIn, ZoomOut, Maximize2, Zap, ChevronUp, ChevronDown, Volume2, Play, Pause, Square, Circle, SkipBack, Repeat, Save, Cable, Mic, Upload, X, Download, Plus, SlidersHorizontal, Music2, Cpu } from 'lucide-react';

import {
  useMasterClock,
  PPQ,
} from '@/app/context/MasterClockContext';

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

/* Creation ↔ SE2 parity: transport + playhead mirror Studio Editor 2 **contracts** using
 * `app/lib/creationStation/*`, `creationPlaylineWapi`, and **constants only** from
 * `@/app/lib/studio/se2TransportClock`. Do **not** import or modify `StudioEditor2Screen.tsx` here. */
import {
  SE2_AUDIO_START_FLOOR_SEC,
  refillCreationTransportLookahead,
  resetCreationTransportStepClock,
  reanchorNextStepWhileRunning,
  reanchorNextStepWhileStopped,
} from '@/app/lib/creationStation/creationTransportSystem';
import { useCreationTransportPump } from '@/app/hooks/useCreationTransportPump';
import {
  getCreationTransportBeatEpoch,
  publishCreationTransportBeat,
  subscribeCreationTransportBeat,
} from '@/app/lib/creationStation/creationTransportBeatExternal';
import { beatAtSessionTime, CREATION_METRO_CLICK_ATTACK_SEC } from '@/app/lib/creationStation/creationTransportSync';
import {
  CREATION_DRUM_PLAYLINE_CENTER_X,
  CREATION_PIANO_PLAYLINE_CENTER_X,
  cancelCreationPlaylineWapi,
  creationPlaylineColFAndPx,
  launchCreationPlaylineWapi,
  setCreationPlaylineTransformStatic,
} from '@/app/lib/creationStation/creationPlaylineWapi';
import {
  creationDrumGridStepBottomBorder,
  creationDrumGridVerticalLineColor,
} from '@/app/lib/creationStation/creationDrumGridAdaptive';

import {
  defaultPadSamplerPlaybackOpts,
  fileToStoredPadSample,
  loadPadSampleStore,
  padSampleKey,
  type PadSamplerPlaybackOpts,
  samplerOptsFromStored,
  savePadSampleStore,
  storedToArrayBuffer,
  writeSamplerOptsToStored,
} from '@/app/lib/padSampleStorage';
import { DrumKitGeneratorModal } from '@/app/components/creation/DrumKitGeneratorModal';
import {
  audioBufferToStoredKitSample,
  buildKitGroovePattern,
  synthesizeKitPadBuffer,
  type DrumKitGeneratorStyle,
} from '@/app/lib/creationStation/drumKitGenerator';
import { ChordBuilderTab } from '@/app/components/creation/ChordBuilderTab';
import AiPatternScreen from '@/app/screens/AiPatternScreen';
import ChordSequencerScreen from '@/app/screens/ChordSequencerScreen';
import { uint8ArrayToBase64 } from '@/app/lib/creationStation/chordRender';

import {
  normalizePianoSnapSubdiv,
  PIANO_SNAP_SUBDIV_STORAGE_KEY,
  readPianoSnapSubdivFromStorage,
  snapLabelFromPianoSnapSubdiv,
  ticksPerPianoSnapCell,
} from '@/app/lib/sharedPianoSnapSubdiv';

const DMB_STUDIO_PRECOUNT_CANCEL = 'dmb-studio-precount-cancel';

// ── MIDI Note to Frequency (standard A=440Hz) ──────────────────────────────────

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


// ── Constants ─────────────────────────────────────────────────────────────────

const KITS         = ['Default','Trap 808','Lo-Fi','Acoustic','Electronic','Afrobeats'];

const BANKS        = ['A','B','C','D','E','F','G','H'];

const NOTES        = ['C5','B4','A#4','A4','G#4','G4','F#4','F4','E4','D#4','D4','C#4','C4','B3','A#3','A3'];

const PAD_VEL      = [115,90,90,90,90,90,90,90,90,90,90,90,90,90,90,127];

const INSTRUMENTS  = ['Piano','Synth','Bass','Lead'];


const DRUM_GRID_BARS   = 16;
const CREATION_PIANO_BARS = 64;

const TOTAL_BARS       = CREATION_PIANO_BARS;

const MEASURES_PER_BAR = 4;
/** User rule: four metronome quarter-clicks = four “measures” = one Creation “bar” — never use time-sig `qpb` here. */
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
const ROW_H            = 28;

const MIN_CW           = 24;

const MAX_CW           = 128;

const DEF_CW           = 64;

const ZOOM_STEP        = 4;

// Keep drum programming grid comfortably large for faster step entry.
const DRUM_GRID_ROW_H  = 48;
const DRUM_GRID_MIN_CW = MIN_CW;
const PIANO_GRID_MIN_CW = 24;

/** Max “cells per quarter” (1/128 straight → 32; triplet modes use 3 / 6). */
const DRUM_MAX_SUBDIV = 32;

/**
 * WAAPI runs on the compositor timeline; clicks are scheduled on the audio clock. The playline uses
 * {@link CREATION_PLAYLINE_WAPI_LEAD_SEC} plus {@link creationPlaylineOutputDacLeadSec} (same idea as
 * Studio `displayAudioNowForStudio` DAC term) so the line lines up with **heard** downbeats. Applies
 * **only** while `play === true` — not to `sessionStartRef`, `beatAtSessionTime`, or HUD.
 */
const CREATION_PLAYLINE_WAPI_LEAD_SEC = 0.052;

/** Same cap as Studio playhead DAC term — `outputLatency` + `baseLatency` can over-report on some stacks. */
function creationPlaylineOutputDacLeadSec(ctx: AudioContext | null): number {
  if (!ctx || ctx.state === 'closed') return 0;
  const ol = typeof ctx.outputLatency === 'number' && ctx.outputLatency > 0 ? ctx.outputLatency : 0;
  const bl = typeof ctx.baseLatency === 'number' && ctx.baseLatency > 0 ? ctx.baseLatency : 0;
  return Math.min(0.12, ol + bl);
}

/** One readout for BAR / MSR / phrase — derived from the same pattern column as the playhead + ruler. */
type CreationHudSync = { bar: number; measure: number; phrase: number };

function creationDrumColOffsetSteps(
  loopOn: boolean,
  loopStartBeat: number,
  subdiv: number,
): number {
  const s = Math.max(1, Math.min(DRUM_MAX_SUBDIV, Math.round(subdiv)));
  return Math.floor(Math.max(0, loopOn ? loopStartBeat * s : 0) + 1e-8);
}

/** Integer pattern column `ci` — same math as `beatMathCol` / playline loop wrap. */
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

/** Pattern column from fractional beat — same mapping as `creationPatternColFromTransportStep` + playline. */
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

/** Resets quant cell imperative styles (legacy pump tint — kept for tab switches / cleanup). */
function clearQuantMeasureCellImperativeLit(el: HTMLElement | null): void {
  if (!el) return;
  el.style.background = '#121212';
  el.style.color = '#b98ab9';
  el.style.boxShadow = 'none';
  el.removeAttribute('data-drum-quant-imperative-lit');
}

/** Parse `translate3d(tx px,…)` or CSS `matrix` / `matrix3d` translate X (px) from a keyframe string. */
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
 * Does not modify `currentTime` — only reads keyframes + timing.
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
 * - **Measure** uses the same phase as the metronome: `(⌊beat⌋ − transportOriginBeat) % q` so MSR
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

/** Studio Editor 2 `formatBarsBeatsTicks` — global bar · beat-in-bar · centisecond tick. */
function formatCreationSe2BarsBeatsTicks(displayBeats: number, beatsPerBar: number): string {
  const bpb = Math.max(1, beatsPerBar);
  const db = Math.max(0, displayBeats);
  const bar = Math.floor(db / bpb) + 1;
  const beatInBar = Math.floor(db % bpb) + 1;
  const tick = Math.floor((db % 1) * 100);
  return `${bar}.${beatInBar}.${String(tick).padStart(2, '0')}`;
}

/** Studio Editor 2 `formatTimeMmSsFf` — MM:SS:cs from musical time at BPM. */
function formatCreationSe2TimeMmSsFf(beats: number, bpm: number): string {
  const totalSeconds = (Math.max(0, beats) / Math.max(1, bpm)) * 60;
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  const f = Math.floor((totalSeconds % 1) * 100);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}:${String(f).padStart(2, '0')}`;
}

/** Fixed 1:1 pad index → mixer channel (CH1–CH16); not user-editable. */
function creationPadMixerCh(padIndex: number): number {
  return padIndex + 1;
}

const CREATION_PAD_CHANNELS_FIXED = Array.from({ length: 16 }, (_, i) => i + 1);

// ── BAR/MEASURE HUD: display-only from master transport frame state ────────────────────────────────

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

/** BAR digits only — {@link paintCreationHudQuarterIntoDom} updates `barDigits` during play/rec. */
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

type CreationTransportHudMsrProps = {
  qpb: number;
  measureInBar: number;
  phraseEveryFourMeasures: number;
  debugText?: string;
  paintHudFromRaf?: boolean;
  hudDomSlotsRef?: MutableRefObject<CreationHudDomSlots>;
};

/** Measure / phrase readout (BAR counter mounts next to SEQUENCE on the grid tab). */
function CreationTransportHudMsr({
  qpb,
  measureInBar,
  phraseEveryFourMeasures,
  debugText,
  paintHudFromRaf,
  hudDomSlotsRef,
}: CreationTransportHudMsrProps) {
  const measureLedCount = Math.max(2, Math.min(16, Math.round(qpb)));
  const showReactHudText = !paintHudFromRaf;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        padding: '1px 8px',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          fontSize: 7,
          color: '#888',
          fontWeight: 700,
          lineHeight: 1.15,
          justifyContent: 'center',
        }}
      >
        <span
          ref={(el) => {
            if (hudDomSlotsRef) hudDomSlotsRef.current.msrFrac = el;
          }}
        >
          {showReactHudText ? `${measureInBar}/${measureLedCount}` : '\u2007\u2007\u2007\u2007'}
        </span>
        <span
          ref={(el) => {
            if (hudDomSlotsRef) hudDomSlotsRef.current.phrase = el;
          }}
          style={{ color: '#6a6a78', fontSize: 6 }}
        >
          {showReactHudText ? `PH${phraseEveryFourMeasures}` : '\u2007\u2007\u2007\u2007'}
        </span>
      </div>
      {debugText ? (
        <span
          title={debugText}
          style={{
            fontSize: 6,
            color: '#f66',
            maxWidth: 56,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            letterSpacing: 0.2,
          }}
        >
          {debugText}
        </span>
      ) : null}
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
  /* Genius-style bar banding: every 4 steps (one “measure” strip) slightly lifted */
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
 * Returns `stop()` to cut this voice (long files, stacking hits, accidental “loops” from retriggers).
 */
function playPadSampleBuffer(
  ctx: AudioContext,
  buffer: AudioBuffer,
  chId: number,
  vel: number,
  when: number,
  channelVolumes: Record<number, number>,
  /** 1 = native file speed — rate also shifts pitch (Web Audio). */
  playbackRate = 1,
  /** Fires when this voice ends (natural or `stop()`) — for sampler voice bookkeeping. */
  afterDispose?: () => void,
  sampler: PadSamplerPlaybackOpts = defaultPadSamplerPlaybackOpts(),
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
  const rateMul = Math.pow(2, sampler.fineSemi / 12);
  src.playbackRate.value = Math.min(4, Math.max(0.0625, playbackRate * rateMul));
  const g = ctx.createGain();
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
  tail.connect(g);
  g.connect(panNode);

  const dur = buffer.duration;
  const t0 = Math.max(0, Math.min(0.9999, sampler.trim0)) * dur;
  const t1 = Math.max(t0 + 0.002, Math.min(dur, sampler.trim1 * dur));
  const playDur = Math.max(0.002, t1 - t0);

  let disposed = false;
  const disposeGraph = () => {
    if (disposed) return;
    disposed = true;
    try {
      g.gain.cancelScheduledValues(ctx.currentTime);
    } catch {
      /* */
    }
    try {
      src.disconnect();
      hpNode?.disconnect();
      lpNode?.disconnect();
      g.disconnect();
      panNode.disconnect();
    } catch {
      /* */
    }
    afterDispose?.();
  };
  src.onended = disposeGraph;

  const stop = () => {
    if (disposed) return;
    try {
      src.stop(0);
    } catch {
      /* InvalidStateError — already stopped or not started */
    }
    disposeGraph();
  };

  try {
    /** MPC-style sample trigger: brief overshoot on the output gain, then settle (harder one-shot punch). */
    if (snap < 1e-4) {
      g.gain.setValueAtTime(vol, when);
    } else {
      const peakMul = 1 + snap * 0.62;
      const decaySec = 0.0012 + (1 - snap) * 0.016;
      g.gain.cancelScheduledValues(when);
      g.gain.setValueAtTime(vol * peakMul, when);
      g.gain.linearRampToValueAtTime(vol, when + decaySec);
    }
    src.start(when, t0, playDur);
  } catch {
    disposeGraph();
    return () => {};
  }
  return stop;
}

/** Decimated peaks for sample-edit waveform (absolute sample magnitudes, 0…1 per bucket). */
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

interface Bank   { drums: DrumPattern; notes: PianoNote[]; }

function emptyDrums(): DrumPattern {
  return Array.from({ length: 16 }, () => Array(TOTAL_COLS).fill(false));
}

type CreationStarterPreset = 'hiphopA' | 'hiphopB' | 'rnbA' | 'rnbB';
type PatternSlot = 'A' | 'B';


// ── Ruler ─────────────────────────────────────────────────────────────────────

function Ruler({
  activeCol,
  colWidth,
  maxBars = TOTAL_BARS,
  barNumberStart = 1,
  onRangeCommit,
  stepsPerBar = MEASURES_PER_BAR,
  /** If set (sum must match drum pattern column count), beat row uses variable widths per bar — keeps ruler aligned with the grid in odd meters. */
  barStepCounts,
  /** When `barStepCounts` groups columns differently from one DAW bar per segment, set header labels (e.g. DAW bar at each segment start). */
  segmentHeaderLabels,
  /** Map pattern column index → DAW bar for loop drag; required when segment count ≠ DAW bars in range. */
  patternColToDawBar,
  /**
   * When set, the beat row highlights the **beat within the bar** (1…`creationBeatsPerBar`) that contains `activeCol`,
   * using `creationStepSubdiv` columns per beat (e.g. 4 for 16ths). Omit `creationStepSubdiv` for 1 column = 1 beat.
   */
  creationBeatHighlight,
  creationBeatsPerBar,
  creationStepSubdiv,
  disablePlayheadHighlight = false,
  /** When set, each beat cell is exactly `colWidth` px (border-box) with pad-matching vertical grid lines — required for playline ↔ digit alignment. */
  drumGridBeatBorders,
  onSeekPatternCol,
}: {
  activeCol: number;
  colWidth: number;
  maxBars?: number;
  /** First bar label (1-based) — use for global bar numbers when the loop is not at bar 1. */
  barNumberStart?: number;
  /** Drag across bar headers to set shared loop range (master loop state). */
  onRangeCommit?: (startBar: number, endBar: number) => void;
  /** Quarter-note columns per bar — fallback when `barStepCounts` omitted. */
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

  let colStartAcc = 0;
  return (
    <div ref={headerRef} style={{ display: 'flex', height: 28, flexShrink: 0 }}>
      {Array.from({ length: barN }, (_, bi) => {
        const stepsThisBar = counts[bi]!;
        const colStart = colStartAcc;
        colStartAcc += stepsThisBar;
        /** Drum Beat Lab: no segment-wide header tint — only the digit under the playline column turns violet. */
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
                /** Flat column model — pad grid has no per-bar inset; extra 1px here skewed playline vs digits. */
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
                fontSize: 8,
                fontFamily: 'monospace',
                fontWeight: 700,
                color: isActiveBar ? color : '#4a4a58',
                textAlign: 'center',
                lineHeight: '14px',
                background: isActiveBar ? `${color}15` : 'transparent',
                borderBottom: `2px solid ${isActiveBar ? color : '#1a1a24'}`,
                cursor: onRangeCommit ? 'ew-resize' : 'default',
                touchAction: 'none',
              }}
            >
              {barLabel}
            </div>
            <div style={{ display: 'flex', flex: 1 }}>
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
                /** Quantize row: global step index in bar (1/8 ⇒ 1…8, 1/16 ⇒ 1…16, …) — one digit per sequencer column. */
                const quantStepLabel = String(mi + 1);
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
                      lineHeight: '13px',
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


// ── BankButtons (memoized to prevent re-render on BPM change) ─────────────────

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


// ── Beat Lab deck toolbar (under transport — preset, uploads, kit, sampler) ─

interface BeatLabDeckToolbarProps {
  kit: string;
  setKit: (k: string) => void;
  hasPadSample: (padIndex: number) => boolean;
  onLoadPadSample: (padIndex: number) => void;
  onClearPadSample: (padIndex: number) => void;
  geniusStarterActive?: CreationStarterPreset | null;
  onGeniusStarter?: (k: CreationStarterPreset) => void;
  onGeniusRecord?: () => void;
  onGeniusUpload?: () => void;
  onGeniusMySoundPlay?: (padIndex: number) => void;
  /** Stop all currently playing sample voices on this pad (long samples / stacked hits). */
  onStopPadSamplePlayback?: (padIndex: number) => void;
  /** Pad index 0–15 that receives the next file from “Upload sound”. */
  geniusSamplerTargetPad?: number;
  onGeniusSamplerTargetPadChange?: (padIndex: number) => void;
  /** Source BPM for tempo sync (optional per pad). */
  padSampleRootBpmForPad?: (padIndex: number) => number | undefined;
  onCommitPadSampleRootBpm?: (padIndex: number, raw: string) => void;
  /** Loaded sample display name (matches sequencer lane when set). */
  padSampleLabelForPad?: (padIndex: number) => string | undefined;
  /** Persist display name for this pad’s sample (localStorage + lane label). */
  onCommitPadSampleLabel?: (padIndex: number, label: string) => void;
  /** Bump local numeric field when bank / stored root changes */
  samplerUiBank?: number;
  /** Per-pad HPF/LPF/trim/fine (stored with sample). */
  getPadSamplerOpts?: (padIndex: number) => PadSamplerPlaybackOpts;
  commitPadSamplerOpts?: (padIndex: number, o: PadSamplerPlaybackOpts) => void;
  /** One-shot preview using these opts (does not persist until Apply). */
  onPreviewSamplerFx?: (padIndex: number, o: PadSamplerPlaybackOpts) => void;
  /** Preview with SRC BPM field value (does not persist until blur/Enter). */
  onPreviewSamplerRootBpmDraft?: (padIndex: number, raw: string) => void;
  /** Loaded buffer for trim waveform + time readouts (same pad as Beat Lab lane). */
  getPadSampleAudioBuffer?: (padIndex: number) => AudioBuffer | undefined;
  /** Same row as kit: pattern clear + Studio handoff */
  patternActionsDisabled?: boolean;
  onClearPattern?: () => void;
  onDownloadHandoff?: () => void;
}

function BeatLabDeckToolbar({
  kit,
  setKit,
  hasPadSample,
  onLoadPadSample,
  onClearPadSample,
  geniusStarterActive,
  onGeniusStarter,
  onGeniusRecord,
  onGeniusUpload,
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
  onPreviewSamplerRootBpmDraft,
  getPadSampleAudioBuffer,
  patternActionsDisabled = false,
  onClearPattern,
  onDownloadHandoff,
}: BeatLabDeckToolbarProps) {
  /** Which pad’s SRC BPM popover is open (null = all closed). */
  const [srcBpmOpenPad, setSrcBpmOpenPad] = useState<number | null>(null);
  const [srcBpmDraft, setSrcBpmDraft] = useState('');
  const srcBpmDraftRef = useRef('');
  srcBpmDraftRef.current = srcBpmDraft;
  const srcBpmOpenPadRef = useRef<number | null>(null);
  srcBpmOpenPadRef.current = srcBpmOpenPad;
  /** Stable ref — parent recreates `onCommitPadSampleRootBpm` when `padSamplePresence` changes; must not re-run bank-switch FX close. */
  const onCommitPadSampleRootBpmRef = useRef(onCommitPadSampleRootBpm);
  onCommitPadSampleRootBpmRef.current = onCommitPadSampleRootBpm;

  const [fxOpenPad, setFxOpenPad] = useState<number | null>(null);
  const [fxDraft, setFxDraft] = useState<PadSamplerPlaybackOpts>(() => defaultPadSamplerPlaybackOpts());
  const fxDraftRef = useRef(fxDraft);
  fxDraftRef.current = fxDraft;
  /** Lane / pad name while SAMPLE EDIT is open — kept in ref for document dismiss + pad switch commits. */
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
    // Only when opening a pad or switching bank — not when `padSampleLabelForPad` identity changes (parent inline fn).
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
      if (srcBpmOpenPad !== null && srcBpmOpenPad !== padIndex) {
        onCommitPadSampleRootBpm?.(srcBpmOpenPad, srcBpmDraftRef.current);
      }
      setSrcBpmOpenPad(padIndex);
      const r = padSampleRootBpmForPad?.(padIndex);
      setSrcBpmDraft(r != null && r > 0 ? String(r) : '');
    },
    [srcBpmOpenPad, fxOpenPad, padSampleRootBpmForPad, onCommitPadSampleRootBpm, commitPadSamplerOpts],
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
      if (fxOpenPad !== null && fxOpenPad !== padIndex) {
        onCommitPadSampleLabelRef.current?.(fxOpenPad, fxLabelDraftRef.current.trim());
        commitPadSamplerOpts(fxOpenPad, fxDraftRef.current);
      }
      setFxOpenPad(padIndex);
      setFxDraft({ ...getPadSamplerOpts(padIndex) });
    },
    [fxOpenPad, srcBpmOpenPad, commitPadSamplerOpts, getPadSamplerOpts, onCommitPadSampleRootBpm],
  );

  useEffect(() => {
    const pad = srcBpmOpenPadRef.current;
    if (pad !== null) {
      onCommitPadSampleRootBpmRef.current?.(pad, srcBpmDraftRef.current);
      setSrcBpmOpenPad(null);
    }
    /** Bank switch: close FX panel without auto-commit (avoids writing to wrong bank index). */
    setFxOpenPad(null);
  }, [samplerUiBank]);

  useEffect(() => {
    if (srcBpmOpenPad === null) return;
    const onDocMouseDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest?.('[data-src-bpm-root]')) return;
      if (t?.closest?.('[data-fx-root]')) return;
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
      if (t?.closest?.('[data-src-bpm-root]')) return;
      if (t?.closest?.('[data-beatlab-portal-popover]')) return;
      onCommitPadSampleLabelRef.current?.(fxOpenPad, fxLabelDraftRef.current.trim());
      commitPadSamplerOpts?.(fxOpenPad, fxDraftRef.current);
      setFxOpenPad(null);
    };
    document.addEventListener('mousedown', onDocMouseDown, true);
    return () => document.removeEventListener('mousedown', onDocMouseDown, true);
  }, [fxOpenPad, commitPadSamplerOpts]);

  /** Anchors for fixed popovers (portaled to `document.body` — avoids Creation root `overflow:hidden`). */
  const srcBpmTriggerRefs = useRef<Array<HTMLButtonElement | null>>(Array.from({ length: 16 }, () => null));
  const fxTriggerRefs = useRef<Array<HTMLButtonElement | null>>(Array.from({ length: 16 }, () => null));
  const srcBpmPopoverMeasureRef = useRef<HTMLDivElement | null>(null);
  const fxPopoverMeasureRef = useRef<HTMLDivElement | null>(null);
  type BeatLabPopRect = { left: number; top: number; width: number };
  const [srcBpmPopRect, setSrcBpmPopRect] = useState<BeatLabPopRect | null>(null);
  const [fxPopRect, setFxPopRect] = useState<BeatLabPopRect | null>(null);

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
  }, [fxOpenPad, srcBpmOpenPad]);

  useLayoutEffect(() => {
    layoutBeatLabPortals();
    const id = requestAnimationFrame(() => layoutBeatLabPortals());
    return () => cancelAnimationFrame(id);
  }, [layoutBeatLabPortals, fxDraft, srcBpmDraft]);

  useEffect(() => {
    if (fxOpenPad === null && srcBpmOpenPad === null) return;
    const onResizeOrScroll = () => layoutBeatLabPortals();
    window.addEventListener('resize', onResizeOrScroll);
    window.addEventListener('scroll', onResizeOrScroll, true);
    return () => {
      window.removeEventListener('resize', onResizeOrScroll);
      window.removeEventListener('scroll', onResizeOrScroll, true);
    };
  }, [fxOpenPad, srcBpmOpenPad, layoutBeatLabPortals]);

  const showGeniusDeck = typeof onGeniusStarter === 'function';

  const starterPresets = (
    [
      ['Hip-Hop A', 'hiphopA'],
      ['Hip-Hop B', 'hiphopB'],
      ['R&B A', 'rnbA'],
      ['R&B B', 'rnbB'],
    ] as const
  );

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
        }}
      >
        {showGeniusDeck ? (
          <>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                flexShrink: 0,
                border: '2px solid rgba(124, 244, 198, 0.45)',
                background: 'radial-gradient(circle at 35% 30%, #1c1c24 0%, #0a0a0e 70%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              title="Preset beat — pick a style"
            >
              <span style={{ fontSize: 6, fontWeight: 800, color: '#888', textAlign: 'center', lineHeight: 1.1 }}>
                PRE
                <br />
                SET
              </span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 8, color: '#6a6a78', fontWeight: 900, letterSpacing: 1 }}>STYLE</span>
              {starterPresets.map(([label, key]) => {
                const on = geniusStarterActive === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => onGeniusStarter?.(key)}
                    style={{
                      padding: '4px 8px',
                      borderRadius: 4,
                      border: `1px solid ${on ? 'rgba(124, 244, 198, 0.55)' : '#2a2a32'}`,
                      background: on ? 'rgba(124, 244, 198, 0.16)' : '#0c0c12',
                      color: on ? '#7cf4c6' : '#ccc',
                      fontSize: 9,
                      fontWeight: 800,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            <button type="button" onClick={() => onGeniusRecord?.()} style={{ ...miniBtn }}>
              <Mic size={16} strokeWidth={2} />
              Record vocals
            </button>
            <button type="button" onClick={() => onGeniusUpload?.()} style={{ ...miniBtn }}>
              <Upload size={16} strokeWidth={2} />
              Upload
            </button>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 140, maxWidth: 220 }}>
              <label style={{ fontSize: 7, color: '#6a6a78', fontWeight: 800 }}>Upload → pad</label>
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
          title="Kit (e.g. Default) · Clear pattern · Download to Studio"
        >
          <select
            value={kit}
            onChange={(e) => setKit(e.target.value)}
            title="Drum kit"
            style={{
              padding: '5px 8px',
              borderRadius: 4,
              border: '1px solid rgba(167, 139, 250, 0.35)',
              background: '#0c0c12',
              color: '#e8e8f0',
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer',
              maxWidth: 124,
              minWidth: 0,
              flex: '0 1 auto',
              boxSizing: 'border-box',
            }}
          >
            {KITS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
          {typeof onClearPattern === 'function' ? (
            <button
              type="button"
              disabled={patternActionsDisabled}
              onClick={() => {
                if (patternActionsDisabled) return;
                onClearPattern();
              }}
              title="Clear drum steps for current bank / pattern slot — Genius-style Clear."
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                height: 28,
                padding: '0 8px',
                borderRadius: 4,
                border: '1px solid #633',
                background: '#1a1a24',
                color: '#f6a9a9',
                fontSize: 10,
                fontWeight: 800,
                cursor: patternActionsDisabled ? 'not-allowed' : 'pointer',
                opacity: patternActionsDisabled ? 0.45 : 1,
                flexShrink: 0,
                whiteSpace: 'nowrap',
              }}
            >
              <X size={13} />
              Clear
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
              title="Export / Studio handoff (closest to Genius Home Studio Download WAV — full render uses Export)."
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
        </div>
      </div>

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
          style={{ fontSize: 8, color: '#7cf4c6', fontWeight: 800, marginBottom: 3, letterSpacing: 0.5 }}
          title={
            'Sampler pad 1–16 is the same pad as Beat Lab lane 1–16: a sound loaded here is that lane’s sample. 8×2 MPC layout. FX/SRC BPM per pad; Apply FX before switching bank.'
          }
        >
          SAMPLER · 16 PADS
        </div>
        {/* Fixed 8×2 MPC layout — short BAR/MSR header frees vertical space for taller pad cells */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(8, minmax(0, 1fr))',
            gridTemplateRows: 'repeat(2, minmax(44px, auto))',
            gap: 5,
            width: '100%',
            overflow: 'visible',
          }}
        >
          {Array.from({ length: 16 }, (_, padIndex) => {
            const has = hasPadSample(padIndex);
            const root = padSampleRootBpmForPad?.(padIndex);
            const uploadHere = padIndex === geniusSamplerTargetPad;
            const tag = PAD_BANK_GROUP_TAGS[padIndex];
            const sampleName = (has ? padSampleLabelForPad?.(padIndex) : undefined)?.trim() ?? '';
            const rowTag = has && sampleName ? sampleName : tag;
            return (
              <div
                key={padIndex}
                className="cs-pad-hit"
                title={`Sampler pad ${padIndex + 1} = Beat Lab lane ${padIndex + 1} · ${PAD_NAMES[padIndex]} — ${GENIUS_LANE_LABELS[padIndex]} — ${rowTag}${has ? ' · SAMPLE' : ''}${uploadHere ? ' · UPLOAD → this pad' : ''}`}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'stretch',
                  gap: 4,
                  minWidth: 0,
                  minHeight: 44,
                  padding: '5px 6px',
                  borderRadius: 6,
                  border: `1px solid ${
                    uploadHere
                      ? 'rgba(255, 255, 255, 0.22)'
                      : has
                        ? 'rgba(255, 255, 255, 0.12)'
                        : '#2a2a32'
                  }`,
                  background: 'linear-gradient(165deg, rgba(28, 30, 36, 0.78) 0%, rgba(12, 14, 18, 0.88) 100%)',
                  boxShadow: uploadHere
                    ? 'inset 0 1px 0 rgba(255,255,255,0.06), inset 0 -1px 0 rgba(0,0,0,0.40)'
                    : has
                      ? 'inset 0 1px 0 rgba(255,255,255,0.04), inset 0 -1px 0 rgba(0,0,0,0.40)'
                      : 'inset 0 1px 0 rgba(255,255,255,0.03), inset 0 -1px 0 rgba(0,0,0,0.40)',
                  position: 'relative',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 3, minWidth: 0 }}>
                  <span style={{ fontSize: 11, fontWeight: 900, color: '#7cf4c6', flexShrink: 0, width: 14, textAlign: 'center' }}>
                    {padIndex + 1}
                  </span>
                  {getPadSamplerOpts && commitPadSamplerOpts ? (
                    <div data-fx-root={padIndex} style={{ display: 'inline-flex', flexShrink: 0, lineHeight: 0 }}>
                      <button
                        type="button"
                        ref={(el) => {
                          fxTriggerRefs.current[padIndex] = el;
                        }}
                        disabled={!has}
                        onClick={() => {
                          if (!has) return;
                          toggleFxMenu(padIndex);
                        }}
                        title={
                          has
                            ? 'Sample edit: filters, trim, pitch, trigger (saved with this pad)'
                            : 'Load a sample on this pad first — then you can open sample edit'
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
                    </div>
                  ) : null}
                  <span
                    style={{
                      fontSize: 7,
                      fontWeight: 800,
                      color: has && sampleName ? '#d0d0de' : '#6a6a78',
                      flex: 1,
                      minWidth: 0,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {rowTag}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0, marginLeft: 'auto' }}>
                    <button
                      type="button"
                      onClick={() => onGeniusMySoundPlay?.(padIndex)}
                      style={{ border: 'none', background: 'transparent', color: '#9dc6ff', cursor: 'pointer', padding: 2, flexShrink: 0, lineHeight: 0 }}
                      title="Play"
                    >
                      <Play size={15} fill="currentColor" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onStopPadSamplePlayback?.(padIndex)}
                      style={{ border: 'none', background: 'transparent', color: '#9ca3af', cursor: 'pointer', padding: 2, flexShrink: 0, lineHeight: 0 }}
                      title="Stop — cut all playing sample voices on this pad (long loops / stacked hits)"
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
                    {has ? (
                      <button
                        type="button"
                        onClick={() => onClearPadSample(padIndex)}
                        style={{ border: 'none', background: 'transparent', color: '#f87171', cursor: 'pointer', padding: 2, flexShrink: 0, lineHeight: 0 }}
                        title="Clear"
                      >
                        <X size={14} strokeWidth={2.5} />
                      </button>
                    ) : (
                      <span style={{ width: 16, flexShrink: 0 }} aria-hidden />
                    )}
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
                      title="Source BPM (optional) — click to set. Session BPM scales sample speed+pitch."
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
                          <span style={{ color: '#4b5563', fontSize: 7, fontWeight: 700 }}>—</span>
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
            <div style={{ fontSize: 8, color: '#777', fontWeight: 700 }}>Source tempo (40–320)</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
              <button
                type="button"
                title="Preview — hear sample at this tempo (not saved until you leave the field or press Enter)"
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
            placeholder="40–320 or clear"
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
                  title="Preview — hear current slider settings (saved with Apply or when you close this panel)"
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
              {Math.round((fxDraft.triggerSnap ?? 0) * 100)}% — harder hit / less soft fade-in to level
            </div>
            <label
              style={{ fontSize: 7, color: '#888', display: 'block', marginBottom: 4 }}
              title="Studio-style trim: waveform = full file; teal = plays back; dim = outside region. Yellow lines = start / end."
            >
              Trim · wave + time (start / end)
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
                    {dur > 0 ? <span style={{ color: '#6b7280' }}>{` · file ${dur.toFixed(3)} s`}</span> : null}
                  </span>
                </div>
              );
            })()}
            <div style={{ fontSize: 7, color: '#6b7280', marginBottom: 4 }}>Start % (top) · end % (bottom)</div>
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


// ── Main Screen ────────────────────────────────────────────────────────────────

export default function CreationStationScreen({
  onExport,
  isScreenActive = true,
}: {
  onExport: (dest: string) => void;
  isScreenActive?: boolean;
}) {
  /** Transport: audio = `creationTransportSystem`; UI pump = `useCreationTransportPump` (single rAF + single 25ms timer). */
  const CREATION_BACKEND_BLANK = false;

  const {
    triggerChannel,
    channelVolumes,
    getOrCreateAudioContext,
    getMetronomeBusGain,
    // Keep shared audio routing / synth only; Creation transport is local.
  } = useMasterClock();

  type LocalTransportState = 'stopped' | 'playing' | 'paused' | 'recording';
  const [transport, setTransport] = useState<LocalTransportState>('stopped');
  /** Audio lookahead + rAF gate — set only in start / pause / stop (do not mirror from React state here). */
  const runningRef = useRef(false);
  const recordingRef = useRef(false);

  const [bpm, setBpm] = useState(120);
  const bpmRef = useRef(120);
  bpmRef.current = bpm;
  const [metronomeEnabled, setMetronomeEnabled] = useState(true);
  const metroOnRef = useRef(true);
  metroOnRef.current = metronomeEnabled;
  const currentDrumsRef = useRef<boolean[][]>([]);

  // SE2-style loop region in beats (bars * beatsPerBar).
  const [beatsPerBar, setBeatsPerBar] = useState(4);
  const beatsPerBarRef = useRef(4);
  beatsPerBarRef.current = Math.max(2, Math.min(16, Math.round(beatsPerBar)));
  const [loopOn, setLoopOn] = useState(false);
  const loopOnRef = useRef(false);
  loopOnRef.current = loopOn;
  const [loopBars, setLoopBars] = useState(4);
  const loopBarsRef = useRef(4);
  loopBarsRef.current = loopBars;
  /** Same subdivision key as Studio Editor 2 piano/drum grid (1/4 … 1/64). */
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
  /** Last BAR/MEASURE/PH; RAF paints BAR + beat-in-bar + phrase into `creationHudDomRef` during playback. */
  const creationHudHoldRef = useRef({ m: 1, b: 1, ph: 1 });
  const creationHudDomRef = useRef<CreationHudDomSlots>({
    barDigits: null,
    msrFrac: null,
    phrase: null,
  });
  /** Studio Editor 2–style Bars / Time chips above the grid (imperative `textContent`, same strings as SE2). */
  const creationSe2BarsReadoutRef = useRef<HTMLSpanElement | null>(null);
  const creationSe2TimeReadoutRef = useRef<HTMLSpanElement | null>(null);
  /** Last painted BAR|MSR key — from `computeCreationTransportHudFromBeat` during playback. */
  const creationHudQuarterPaintedRef = useRef('');
  const colWidthRef = useRef(colWidth);
  const patternColsDrumsRef = useRef(patternColsDrums);
  const drumStepSubdivRef = useRef(drumStepSubdiv);
  const patternColsDrumsBeatsRef = useRef(patternColsDrumsBeats);
  const drumPlaylineRef = useRef<HTMLDivElement>(null);
  const drumGridContentRef = useRef<HTMLDivElement>(null);
  const pianoPlaylineRef = useRef<HTMLDivElement>(null);
  /** Compositor-thread playline (Studio Editor 2 pattern); RAF must not overwrite while `playState === 'running'`. */
  const creationDrumPlaylineAnimRef = useRef<Animation | null>(null);
  const creationPianoPlaylineAnimRef = useRef<Animation | null>(null);
  const creationDrumQuantGlowAnimRef = useRef<Animation | null>(null);
  /** Beat Lab quant row cells — ref array for clearing any legacy imperative styles on tab change. */
  const quantMeasureCellElsRef = useRef<(HTMLDivElement | null)[]>([]);
  colWidthRef.current = colWidth;
  patternColsDrumsRef.current = patternColsDrums;
  drumStepSubdivRef.current = drumStepSubdiv;
  patternColsDrumsBeatsRef.current = patternColsDrumsBeats;

  /** Latest rAF frame handler (assigned each render so the pump always calls current HUD/playline logic). */
  const creationTransportOnFrameRef = useRef<(bDisplay: number) => void>(() => {});
  /**
   * Last values for which we publish {@link publishCreationTransportBeat}.
   * We only bump on **pattern column** or **BAR|MSR|PH** changes — not every subdiv step — so the main
   * screen is not re-rendered ~32×/s while the playline still moves on the compositor (WAAPI).
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
  const lastScheduledQuarterRef = useRef<number>(Number.NEGATIVE_INFINITY);
  /** Set from `refillCreationSchedule` (defined after `fireStepAt`) so cold start can call it. */
  const refillCreationScheduleRef = useRef<(ctx: AudioContext, ctSnap: number) => void>(() => {});

  /** Same idea as SE2 `scheduledMetroNodesRef` — lookahead queues clicks ~3s ahead; must stop on pause/stop. */
  const scheduledCreationMetroNodesRef = useRef<{ osc: OscillatorNode; gain: GainNode }[]>([]);

  const cancelScheduledCreationMetroNodes = useCallback(() => {
    const arr = scheduledCreationMetroNodesRef.current;
    for (const { osc, gain } of arr) {
      try {
        const c = osc.context;
        if (c.state !== 'closed') osc.stop(c.currentTime);
      } catch {
        /* already stopped */
      }
      try {
        osc.disconnect();
        gain.disconnect();
      } catch {
        /* */
      }
    }
    arr.length = 0;
  }, []);

  /**
   * Metronome click — same contract as SE2 `playClick`: `t0 = max(idealT, ctSnap + 1ms)`.
   * No user “CLICK ms” offset (that was Creation-only and fought the lookahead grid).
   */
  const scheduleMetronomeClickAt = useCallback(
    (ctx: AudioContext, idealT: number, accent: boolean, audioNowForClamp: number) => {
      if (!metroOnRef.current) return;
      try {
        const now = Number.isFinite(audioNowForClamp)
          ? Math.max(0, audioNowForClamp)
          : ctx.currentTime;
        const tSafe = Math.max(idealT, now + 0.001);

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(accent ? 1760 : 1320, tSafe);
        gain.gain.setValueAtTime(0.0001, tSafe);
        gain.gain.exponentialRampToValueAtTime(accent ? 0.14 : 0.1, tSafe + CREATION_METRO_CLICK_ATTACK_SEC);
        gain.gain.exponentialRampToValueAtTime(0.0001, tSafe + 0.03);
        osc.connect(gain);
        const bus = getMetronomeBusGain();
        if (bus && bus.context === ctx) gain.connect(bus);
        else gain.connect(ctx.destination);
        const clickDur = 0.12;
        osc.start(tSafe);
        osc.stop(tSafe + clickDur);
        const entry = { osc, gain };
        scheduledCreationMetroNodesRef.current.push(entry);
        osc.onended = () => {
          const arr = scheduledCreationMetroNodesRef.current;
          const idx = arr.indexOf(entry);
          if (idx !== -1) arr.splice(idx, 1);
          try {
            osc.disconnect();
            gain.disconnect();
          } catch {
            /* already disconnected */
          }
        };
      } catch {
        /* non-critical */
      }
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
      pianoPlaylineRef.current,
      null,
    );
    const drumEl = drumPlaylineRef.current;
    const pianoEl = pianoPlaylineRef.current;
    if (drumEl) drumEl.style.transform = `translate3d(${-CREATION_DRUM_PLAYLINE_CENTER_X}px, 0, 0)`;
    if (pianoEl) pianoEl.style.transform = `translate3d(${-CREATION_PIANO_PLAYLINE_CENTER_X}px, 0, 0)`;
  }, []);

  /**
   * Imperative snap: cancel WAAPI + `transform` — **only while transport is not running**.
   * During play, motion + loop wrap are owned by {@link launchCreationPlaylineWapiNow} (compositor);
   * calling this with `runningRef` true would cancel that anim and desync the line from audio.
   */
  const updateCreationPlaylineTransforms = useCallback((beatNow: number) => {
    if (runningRef.current) return;
    cancelCreationPlaylineWapi(
      {
        drumAnimRef: creationDrumPlaylineAnimRef,
        pianoAnimRef: creationPianoPlaylineAnimRef,
        drumQuantGlowAnimRef: creationDrumQuantGlowAnimRef,
      },
      drumPlaylineRef.current,
      pianoPlaylineRef.current,
      null,
    );
    const cw = Math.max(colWidthRef.current, DRUM_GRID_MIN_CW);
    const pcw = Math.max(colWidthRef.current, PIANO_GRID_MIN_CW);
    setCreationPlaylineTransformStatic({
      drumEl: drumPlaylineRef.current,
      pianoEl: pianoPlaylineRef.current,
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
  }, []);

  /** WAAPI owns drum/piano playline motion + loop segment (pause → seek → play); SE2 contract. */
  const launchCreationPlaylineWapiNow = useCallback((beatNow: number, play: boolean) => {
    const cw = Math.max(colWidthRef.current, DRUM_GRID_MIN_CW);
    const pcw = Math.max(colWidthRef.current, PIANO_GRID_MIN_CW);
    const bpmR = Math.max(1, bpmRef.current);
    const leadSec =
      CREATION_PLAYLINE_WAPI_LEAD_SEC + creationPlaylineOutputDacLeadSec(ctxRef.current);
    const beatForWapi = play ? beatNow + leadSec * (bpmR / 60) : beatNow;
    launchCreationPlaylineWapi(
      {
        drumAnimRef: creationDrumPlaylineAnimRef,
        pianoAnimRef: creationPianoPlaylineAnimRef,
        drumQuantGlowAnimRef: creationDrumQuantGlowAnimRef,
      },
      {
        drumEl: drumPlaylineRef.current,
        pianoEl: pianoPlaylineRef.current,
        drumQuantGlowEl: null,
        beatNow: beatForWapi,
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
      },
    );
  }, []);

  /** Studio Editor 2–style Bars / Time text (same `formatBarsBeatsTicks` + `formatTimeMmSsFf` as SE2). */
  const paintCreationSe2TransportReadouts = useCallback((beats: number, paused: boolean) => {
    const db = Math.max(0, beats);
    const bpb = Math.max(2, Math.min(16, Math.round(beatsPerBarRef.current)));
    const bpmR = Math.max(1, bpmRef.current);
    const bars = formatCreationSe2BarsBeatsTicks(db, bpb);
    const time = formatCreationSe2TimeMmSsFf(db, bpmR);
    const br = creationSe2BarsReadoutRef.current;
    const tr = creationSe2TimeReadoutRef.current;
    if (br) br.textContent = paused ? `pause ${bars}` : bars;
    if (tr) tr.textContent = time;
  }, []);

  const startTransport = useCallback(async (mode: 'play' | 'record') => {
    const ctx = await ensureCtx();
    /** Preserve fractional beat (stop / pause / scrub) — snapping to `floor` here caused playhead + audio to jump on Play. */
    const origin = Math.max(0, cursorBeatRef.current);
    cursorBeatRef.current = origin;
    originBeatRef.current = origin;
    displayBeatRef.current = origin;
    const tCapture = Math.max(0, ctx.currentTime);
    sessionStartRef.current = tCapture + SE2_AUDIO_START_FLOOR_SEC;
    const spb = 60 / Math.max(1, bpmRef.current);
    /** Next quarter boundary at/after `origin` — `floor` put `tGrid` in the past mid-beat and broke refill sync. */
    const k0 = Math.ceil(origin - 1e-8);
    nextStepBeatRef.current = k0;
    nextStepTimeRef.current = sessionStartRef.current + (k0 - origin) * spb;
    lastScheduledQuarterRef.current = k0 - 1;
    // Must flip refs before immediate refill so beat-0 is actually queued now (not one interval late).
    runningRef.current = true;
    recordingRef.current = mode === 'record';
    refillCreationScheduleRef.current(ctx, tCapture);
    /**
     * Commit transport (playhead opacity, etc.) **before** the first `element.animate()`.
     * Otherwise the same commit that applies `opacity` can drop or stall the compositor animation
     * until a later relaunch — `flushSync` forces DOM updates synchronously in the gesture stack.
     */
    flushSync(() => {
      setTransport(mode === 'record' ? 'recording' : 'playing');
    });
    /**
     * WAAPI playhead: one launch after DOM matches `playing`, on the **audio** clock.
     */
    const tPost = Math.max(0, ctx.currentTime);
    const ss = sessionStartRef.current;
    /** Same beat for playline + `displayBeatRef` / MSR — a WAAPI-only advance here skewed the arrow ahead of the 1–8 count. */
    const beatLaunch = beatAtSessionTime(tPost, ss, originBeatRef.current, bpmRef.current);
    displayBeatRef.current = beatLaunch;
    launchCreationPlaylineWapiNow(beatLaunch, true);
    /**
     * Defer follow-scroll + HUD paint to the next macrotask so the compositor can commit the first WAAPI
     * frame before this thread runs heavy DOM — removes a slight “stuck then moves” feel on Play.
     */
    window.setTimeout(() => {
      if (!runningRef.current) return;
      if (followRef.current) {
        const subdivR = Math.max(1, Math.min(DRUM_MAX_SUBDIV, Math.round(drumStepSubdivRef.current)));
        const pcolsR = Math.max(1, patternColsDrumsRef.current);
        const cwD = Math.max(colWidthRef.current, DRUM_GRID_MIN_CW);
        const cwP = Math.max(colWidthRef.current, PIANO_GRID_MIN_CW);
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
        scrollOne(pianoScrollRef.current, pos0.pianoX);
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
  }, [ensureCtx, SE2_AUDIO_START_FLOOR_SEC, launchCreationPlaylineWapiNow, paintCreationSe2TransportReadouts]);

  const pauseTransport = useCallback(async () => {
    cancelScheduledCreationMetroNodes();
    const ctx = await ensureCtx();
    const t = Math.max(0, ctx.currentTime);
    const b = beatAtSessionTime(t, sessionStartRef.current, originBeatRef.current, bpmRef.current);
    cursorBeatRef.current = b;
    displayBeatRef.current = b;
    originBeatRef.current = b;
    runningRef.current = false;
    recordingRef.current = false;
    // Keep compositor ownership: paused WAAPI at `b`, never cancel-while-running + CSS snap.
    launchCreationPlaylineWapiNow(b, false);
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
  }, [cancelScheduledCreationMetroNodes, ensureCtx, launchCreationPlaylineWapiNow, paintCreationSe2TransportReadouts]);

  const stopTransport = useCallback(() => {
    cancelScheduledCreationMetroNodes();
    let b = displayBeatRef.current;
    const ctx = ctxRef.current;
    if (ctx && ctx.state !== 'closed' && sessionStartRef.current > 0 && runningRef.current) {
      const t = Math.max(0, ctx.currentTime);
      b = beatAtSessionTime(t, sessionStartRef.current, originBeatRef.current, bpmRef.current);
    }
    runningRef.current = false;
    recordingRef.current = false;
    cursorBeatRef.current = b;
    originBeatRef.current = b;
    displayBeatRef.current = b;
    sessionStartRef.current = 0;
    lastScheduledQuarterRef.current = Number.NEGATIVE_INFINITY;
    resetCreationTransportStepClock({ nextStepBeatRef, nextStepTimeRef });
    reanchorNextStepWhileStopped({ nextStepBeatRef, nextStepTimeRef }, b);
    updateCreationPlaylineTransforms(b);
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
    lastScheduledQuarterRef,
    updateCreationPlaylineTransforms,
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
      updateCreationPlaylineTransforms(nb);
    }
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
    updateCreationPlaylineTransforms,
    launchCreationPlaylineWapiNow,
    paintCreationSe2TransportReadouts,
  ]);

  /** Click timeline column (ruler / quant row / Ctrl+pad) → move playhead to that step. */
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

  /** Ruler segments: one header per DAW bar = `beatsPerBar` × current step subdivision. */
  const creationDrumRulerCounts = useMemo(() => {
    const cols = patternColsDrums;
    const q = Math.max(2, Math.min(16, Math.round(beatsPerBar)));
    const step = q * drumStepSubdivUi;
    const out: number[] = [];
    for (let o = 0; o < cols; o += step) {
      out.push(Math.min(step, cols - o));
    }
    return out;
  }, [patternColsDrums, drumStepSubdivUi, beatsPerBar]);
  const { notes: sharedNotes, addNote: addSharedNote, removeNote: removeSharedNote } = usePianoNotes();

  /** Land on Genius Home Studio layout (sounds rail + sequence) — drums / piano remain one click away. */
  const [tab, setTab]               = useState<'drums' | 'grid' | 'piano' | 'chord' | 'ai-pattern' | 'chord-seq'>('grid');
  const [drumKitGenOpen, setDrumKitGenOpen] = useState(false);
  const [drumKitGenStyle, setDrumKitGenStyle] = useState<DrumKitGeneratorStyle>('house');
  const [drumKitGenBusy, setDrumKitGenBusy] = useState(false);
  const [bpmInput, setBpmInput]     = useState(String(bpm));
  const [kit, setKit]               = useState(KITS[0]);
  const [activeBank, setActiveBank] = useState(0);
  const [rollInstr, setRollInstr]   = useState(0);
  const [banks, setBanks]           = useState<Bank[]>(() => {
    const saved = localStorage.getItem('creationStation_banks');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.map((b: any) => ({
          drums: b.drums.map((row: any) => Array.isArray(row) ? row : Array(TOTAL_COLS).fill(false)),
          notes: b.notes || []
        }));
      } catch (e) {
        console.debug('Failed to load banks:', e);
      }
    }
    return BANKS.map(() => ({ drums: emptyDrums(), notes: [] }));
  });
  const [patternSlot, setPatternSlot] = useState<PatternSlot>('A');
  const [bankPatternSlots, setBankPatternSlots] = useState<
    Array<Record<PatternSlot, DrumPattern>>
  >(() => BANKS.map(() => ({ A: emptyDrums(), B: emptyDrums() })));
  const patternSlotsInitializedRef = useRef(false);
  const bankPatternSlotsRef = useRef<Array<Record<PatternSlot, DrumPattern>>>([]);

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
    if (banks.length === 0) return;
    let loaded: Array<Record<PatternSlot, DrumPattern>> | null = null;
    try {
      const raw = localStorage.getItem('creationStation_patternSlots');
      if (raw) {
        const parsed = JSON.parse(raw) as unknown;
        if (Array.isArray(parsed)) {
          loaded = parsed.map((entry) => {
            const e = entry as Partial<Record<PatternSlot, DrumPattern>>;
            const a = Array.isArray(e.A) ? e.A : emptyDrums();
            const b = Array.isArray(e.B) ? e.B : emptyDrums();
            return { A: a, B: b };
          });
        }
      }
    } catch {
      /* ignore */
    }
    setBankPatternSlots(() =>
      BANKS.map((_, i) => ({
        A: loaded?.[i]?.A?.map((r) => r.slice()) ?? banks[i]?.drums.map((r) => r.slice()) ?? emptyDrums(),
        B: loaded?.[i]?.B?.map((r) => r.slice()) ?? emptyDrums(),
      })),
    );
    patternSlotsInitializedRef.current = true;
  }, [banks]);
  useEffect(() => {
    if (!patternSlotsInitializedRef.current) return;
    const slotDrums = bankPatternSlots[activeBank]?.[patternSlot];
    if (!slotDrums) return;
    setBanks((prev) =>
      prev.map((b, i) => (i === activeBank ? { ...b, drums: slotDrums.map((r) => r.slice()) } : b)),
    );
  }, [activeBank, patternSlot, bankPatternSlots]);
  useEffect(() => {
    bankPatternSlotsRef.current = bankPatternSlots;
  }, [bankPatternSlots]);

  const [pressedPianoKeyRow, setPressedPianoKeyRow] = useState<number | null>(null);
  const [selectedDrumPad, setSelectedDrumPad] = useState<number | null>(null);
  const [activeGeniusStarter, setActiveGeniusStarter] = useState<CreationStarterPreset | null>(null);
  const [mutedPads, setMutedPads] = useState<boolean[]>(() => Array(16).fill(false));
  const mutedPadsRef = useRef<boolean[]>(Array(16).fill(false));
  mutedPadsRef.current = mutedPads;
  /** MPC-style: per-bank pad samples (key `${bank}_${pad}`) — presence drives UI; buffers in ref for playback. */
  const [padSamplePresence, setPadSamplePresence] = useState<Record<string, boolean>>({});
  /** Optional source BPM per sample key — drives simple session sync (playbackRate). */
  const [padSampleRootBpms, setPadSampleRootBpms] = useState<Record<string, number>>({});
  const padSampleRootBpmRef = useRef<Record<string, number>>({});
  /** Display name per pad sample key — mirrors `StoredPadSample.label` (sampler + sequencer lane). */
  const [padSampleLabels, setPadSampleLabels] = useState<Record<string, string>>({});
  const [geniusSamplerTargetPad, setGeniusSamplerTargetPad] = useState(14);
  const padSampleBuffersRef = useRef<Map<string, AudioBuffer>>(new Map());
  /** HPF/LPF/trim/fine-tune per `${bank}_${pad}` — mirrors optional fields on `StoredPadSample`. */
  const padSamplePlaybackOptsRef = useRef<Record<string, PadSamplerPlaybackOpts>>({});
  /** Active `BufferSource` stop fns per pad key — used to silence long/looping samples and stacked hits. */
  const padSampleActiveStoppersRef = useRef<Map<string, Set<() => void>>>(new Map());
  const playPadSoundRef = useRef<(pi: number, vel: number, when?: number) => void>(() => {});
  const activeBankRef = useRef(activeBank);
  const channelVolumesRef = useRef(channelVolumes);
  const pendingPadSampleRef = useRef<number | null>(null);
  const padSampleFileInputRef = useRef<HTMLInputElement | null>(null);

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
    playPadSoundRef.current = (pi: number, vel: number, when?: number) => {
      const ctx = getOrCreateAudioContext();
      if (ctx.state === 'suspended') {
        void ctx
          .resume()
          .then(() => {
            playPadSoundRef.current(pi, vel, when);
          })
          .catch(() => {
            /* ignore resume failure */
          });
        return;
      }
      const t = when ?? ctx.currentTime;
      const rawVelocity = Math.max(0, Math.min(1, vel / 127));
      if (rawVelocity <= MIN_TRIGGER) return;
      const shapedVelocity = Math.pow(rawVelocity, 0.7);
      const safeVelocity = Math.round(
        Math.max(MIN_AUDIBLE_VELOCITY, Math.min(1, shapedVelocity)) * 127,
      );
      const key = `${activeBankRef.current}_${pi}`;
      const buf = padSampleBuffersRef.current.get(key);
      if (buf) {
        const root = padSampleRootBpmRef.current[key];
        const sessionBpm = Math.max(1, bpmRef.current);
        const rate =
          typeof root === 'number' && root > 0
            ? Math.min(4, Math.max(0.25, sessionBpm / root))
            : 1;
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
        voiceStop = playPadSampleBuffer(
          ctx,
          buf,
          creationPadMixerCh(pi),
          safeVelocity,
          t,
          channelVolumesRef.current,
          rate,
          afterVoice,
          sampOpts,
        );
        bag.add(voiceStop);
      } else {
        triggerChannel(creationPadMixerCh(pi), safeVelocity, t);
      }
    };
  }, [triggerChannel, getOrCreateAudioContext]);

  // Shared DAW session: manifest + per-channel sequencer data → Studio tracks/clips (audioTrack === mixer CH).
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
  /** Beat Lab: keep lane labels ↔ pattern rows scrolled together. */
  const geniusLaneScrollRef = useRef<HTMLDivElement>(null);
  const geniusLaneGridScrollSync = useRef<'lane' | 'grid' | null>(null);

  const onGeniusPatternScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const lane = geniusLaneScrollRef.current;
    if (!lane || geniusLaneGridScrollSync.current === 'lane') return;
    geniusLaneGridScrollSync.current = 'grid';
    lane.scrollTop = e.currentTarget.scrollTop;
    queueMicrotask(() => {
      geniusLaneGridScrollSync.current = null;
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

  /** Same subdiv the audio scheduler + playline use (`drumStepSubdivRef`) — avoids one-frame HUD/grid mismatch after snap changes. */
  const subdivHud = Math.max(1, Math.min(DRUM_MAX_SUBDIV, Math.round(drumStepSubdivRef.current)));
  const transportStepIndexLive = Math.floor(Math.max(0, displayBeatLive * subdivHud) + 1e-8);

  /**
   * Quarter index of **loopStartTick** — matches `floor(tick / PPQ)`; avoids
   * `(loopStartBar - 1) * round(qpb)` when `ticksPerBar` and PPQ don’t line up with rounded quarters.
   */
  const drumColOffset = Math.floor(
    Math.max(0, loopOnRef.current ? loopStartBeatRef.current * subdivHud : 0) + 1e-8,
  );

  const creationDrumRulerHeaderLabels = useMemo(() => {
    const labels: number[] = [];
    const colsPerBar = Math.max(1, qpb * subdivHud);
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
  }, [creationDrumRulerCounts, drumColOffset, qpb, loopStartBar, subdivHud]);

  const drumPatternColToDawBar = useCallback(
    (ci: number) =>
      loopStartBar +
      Math.floor((drumColOffset + ci) / Math.max(1, qpb * subdivHud)) -
      Math.floor(drumColOffset / Math.max(1, qpb * subdivHud)),
    [loopStartBar, drumColOffset, qpb, subdivHud],
  );

  /** Pattern column index — shared helper with playline / scheduler / transport rAF. */
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

  /** BAR / MSR / phrase from transport `displayBeatLive`. */
  const qpbHud = Math.max(2, Math.min(16, Math.round(qpb)));
  const hudGridSync = computeCreationTransportHudFromBeat(displayBeatLive, {
    subdiv: subdivHud,
    pcols: patternColsDrums,
    loopOn: loopOnRef.current,
    loopStartBeat: loopStartBeatRef.current,
    loopEndBeat: loopEndBeatRef.current,
    playMode: patternPlayModeRef.current,
    loopStartBar,
    qpb: qpbHud,
    transportOriginBeat: originBeatRef.current,
  });
  const globalQuarter = Math.floor(Math.max(0, displayBeatLive) + 1e-8);
  const measureInBarLive = transportNotStopped ? hudGridSync.measure : 1;
  const displayBarNumberLive = transportNotStopped ? hudGridSync.bar : 1;
  const phraseEveryFourMeasuresLive = transportNotStopped ? hudGridSync.phrase : 1;
  const measureInBarHud = isPlaybackOrRecord
    ? measureInBarLive
    : creationHudHoldRef.current.m;
  const displayBarNumberHud = isPlaybackOrRecord
    ? displayBarNumberLive
    : creationHudHoldRef.current.b;
  const phraseEveryFourMeasuresHud = isPlaybackOrRecord
    ? phraseEveryFourMeasuresLive
    : creationHudHoldRef.current.ph;
  const hudDebugCol = visualSyncCol;
  const hudDebugText = `⌊b⌋:${globalQuarter} col:${hudDebugCol} step:${transportStepIndexLive} msr:${measureInBarLive}/${qpbHud} bar:${displayBarNumberLive}`;

  useEffect(() => {
    if (!transportNotStopped) {
      publishCreationRulerBeat(null);
    }
  }, [transportNotStopped]);

  const currentDrums = banks[activeBank].drums;
  const currentNotes = banks[activeBank].notes;
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
    /** Must match {@link patternColsDrums} / playline / grid — `patternColsDrumsBeats * subdiv` can exceed `TOTAL_COLS`. */
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
    const ctSnap = ctx.currentTime;
    const whenSnap = Math.max(idealGridT, ctSnap + 0.001);
    const subSpb = (60 / Math.max(1, bpmRef.current)) / subdiv;
    for (let s = 0; s < subdiv; s += 1) {
      const colInPattern = ((posInPattern * subdiv + s) % gridCols + gridCols) % gridCols;
      const bankCol = colInPattern + drumColOff;
      const whenSub = whenSnap + s * subSpb;
      patternDrums.forEach((row, pi) => {
        if (row[bankCol] && !mutedPadsRef.current[pi]) {
          playPadSoundRef.current(pi, PAD_VEL[pi] ?? 90, whenSub);
        }
      });
    }
    /**
     * Downbeat matches MSR / quant row: same quarter phase as {@link computeCreationTransportHudFromBeat}
     * (`floor(originBeat)`), not raw global `k % bpb` (which desyncs accents when play/seek starts mid-bar).
     */
    const bpb = Math.max(2, Math.min(16, Math.round(beatsPerBarRef.current)));
    const orgQ = Math.floor(Math.max(0, originBeatRef.current) + 1e-8);
    const downbeat = (((k - orgQ) % bpb) + bpb) % bpb === 0;
    const tMetro = Math.max(idealGridT, ctSnap + 0.001);
    scheduleMetronomeClickAt(ctx, tMetro, downbeat, ctSnap);
    return true;
  }, [activeBank, originBeatRef, patternPlayModeRef, scheduleMetronomeClickAt, triggerChannel]);

  const refillCreationSchedule = useCallback(
    (ctx: AudioContext, ctSnap: number) => {
      const spb = 60 / Math.max(1, bpmRef.current);
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
      );
    },
    [fireStepAt],
  );

  refillCreationScheduleRef.current = refillCreationSchedule;

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
      const cwP = Math.max(colWidthRef.current, PIANO_GRID_MIN_CW);
      /** Fractional X — same as `creationPlaylineWapi` / static snap (not `⌊col⌋ * cw`, which lags the arrow). */
      const pos = creationPlaylineColFAndPx(
        bDisplay,
        subdiv,
        pcols,
        loopOnRef.current,
        loopStartBeatRef.current,
        loopEndBeatRef.current,
        patternPlayModeRef.current,
        cwD,
        cwP,
      );
      /** Prefer compositor translate when WAAPI is running (SE2 scroll tracks `b` from WAPI, not floored column). */
      const txD = readTranslateXFromWapiKeyframeAnim(drumPlaylineRef.current);
      const txP = readTranslateXFromWapiKeyframeAnim(pianoPlaylineRef.current);
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
      scrollFollowPx(pianoScrollRef.current, pxPiano);
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
    },
    {
      isScreenActive: !!isScreenActive,
      isPlaying,
      getOrCreateAudioContext,
      refillRef: refillCreationScheduleRef,
      onFrameRef: creationTransportOnFrameRef,
    },
  );

  /**
   * Playline relaunch — **same split as Studio Editor 2** (`StudioEditor2Screen` ~6220–6231):
   * 1) “zoom” (here: column width + Creation-only grid geometry: snap subdiv, chain mode, pattern width).
   * 2) Loop bounds only (`loopOn` / `loopStartBeat` / `loopEndBeat`).
   * 3) **BPM / pattern column count** — separate effects below so WAAPI `durationMs` always matches
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

  /** Tempo change during play — rebuild WAAPI so sweep/segment duration tracks `bpmRef` like metronome spacing. */
  useEffect(() => {
    if (!isScreenActive || !runningRef.current) return;
    launchCreationPlaylineWapiNow(displayBeatRef.current, true);
  }, [bpm, isScreenActive, launchCreationPlaylineWapiNow]);

  useEffect(() => {
    if (!isScreenActive || !runningRef.current) return;
    launchCreationPlaylineWapiNow(displayBeatRef.current, true);
  }, [loopOn, loopStartBeat, loopEndBeat, isScreenActive, launchCreationPlaylineWapiNow]);

  /** Loop bounds change while stopped — static playline only (no second WAAPI launch with zoom effect). */
  useEffect(() => {
    if (!isScreenActive || runningRef.current) return;
    updateCreationPlaylineTransforms(cursorBeatRef.current);
  }, [loopOn, loopStartBeat, loopEndBeat, isScreenActive, updateCreationPlaylineTransforms]);

  // Keyboard shortcuts ────────────────────────────────────────────────────────
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Bank switches: 1–8
      if (e.key >= '1' && e.key <= '8') {
        setActiveBank(parseInt(e.key) - 1);
        return;
      }
      // Clear current bank: Ctrl+K
      if (e.ctrlKey && e.key === 'k') {
        e.preventDefault();
        if (confirm(`Clear bank ${BANKS[activeBank]}?`)) {
          setBanks(prev => prev.map((b, i) => i === activeBank ? { drums: emptyDrums(), notes: [] } : b));
        }
        return;
      }
      // Tab switch: Ctrl+T more (placeholder), Ctrl+G Beat Lab, Ctrl+H chord builder
      if (e.ctrlKey) {
        if (e.key === 't') { e.preventDefault(); setTab('drums'); /* More (placeholder) */ }
        else if (e.key === 'g') { e.preventDefault(); setTab('grid'); /* Beat Lab */ }
        else if (e.key === 'h') { e.preventDefault(); setTab('chord'); /* Chord Builder */ }
        else if (e.key === 'a') { e.preventDefault(); setTab('ai-pattern'); /* AI Pattern Generator */ }
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeBank]);

  const zoomIn    = useCallback(() => setColWidth(w => Math.min(MAX_CW, w + ZOOM_STEP)), []);
  const zoomOut   = useCallback(() => setColWidth(w => Math.max(MIN_CW, w - ZOOM_STEP)), []);
  const zoomReset = useCallback(() => setColWidth(DEF_CW), []);
  const fitDrumGridToLoop = useCallback(() => {
    const el = drumScrollRef.current;
    if (!el) return;
    const visible = Math.max(120, el.clientWidth - 8);
    const n = Math.max(1, patternColsDrums);
    /** Integer px/column so N columns fit the scroll viewport — keeps playhead `col*cw` aligned with cell edges. */
    const next = Math.floor(visible / n);
    setColWidth(Math.max(MIN_CW, Math.min(MAX_CW, next)));
    el.scrollLeft = 0;
  }, [patternColsDrums]);
  /** Refit column width whenever loop length / step count changes the column count (not only on manual Fit). */
  useEffect(() => {
    if (tab !== 'grid') return;
    const id = requestAnimationFrame(() => fitDrumGridToLoop());
    return () => cancelAnimationFrame(id);
  }, [fitDrumGridToLoop, patternColsDrums, loopBars, pianoSnapSubdiv, tab]);

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

  const beginLoadPadSample = useCallback((padIndex: number) => {
    pendingPadSampleRef.current = padIndex;
    padSampleFileInputRef.current?.click();
  }, []);

  const handlePadSampleFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    const padRaw = pendingPadSampleRef.current;
    pendingPadSampleRef.current = null;
    if (padRaw == null || !file) return;
    /** Same index as Beat Lab lane 1–16 (row 0 = lane 1). */
    const pad = Math.max(0, Math.min(15, Math.floor(Number(padRaw))));
    const ctx = getOrCreateAudioContext();
    try {
      const storedBase = await fileToStoredPadSample(file);
      const stored = { ...storedBase, rootBpm: bpm };
      const ab = storedToArrayBuffer(stored);
      const buffer = await ctx.decodeAudioData(ab.slice(0));
      const k = padSampleKey(activeBank, pad);
      padSampleBuffersRef.current.set(k, buffer);
      setPadSamplePresence(prev => ({ ...prev, [k]: true }));
      setPadSampleRootBpms((prev) => ({ ...prev, [k]: bpm }));
      const name = typeof stored.label === 'string' ? stored.label.trim() : '';
      if (name) setPadSampleLabels((prev) => ({ ...prev, [k]: name }));
      else setPadSampleLabels((prev) => {
        const n = { ...prev };
        delete n[k];
        return n;
      });
      const store = loadPadSampleStore();
      store[k] = stored;
      writeSamplerOptsToStored(stored, defaultPadSamplerPlaybackOpts());
      savePadSampleStore(store);
      padSamplePlaybackOptsRef.current[k] = defaultPadSamplerPlaybackOpts();
    } catch (err) {
      console.debug('Pad sample load failed:', err);
    }
  }, [activeBank, bpm, getOrCreateAudioContext]);

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

  /** Preview with the SRC BPM typed in the popover (restores committed root after trigger). */
  const previewSamplerRootBpmDraft = useCallback((padIndex: number, raw: string) => {
    const k = padSampleKey(activeBank, padIndex);
    if (!padSampleBuffersRef.current.get(k)) return;
    const prevRoot = padSampleRootBpmRef.current[k];
    const t = raw.trim();
    try {
      if (t === '') {
        delete padSampleRootBpmRef.current[k];
      } else {
        const parsed = parseFloat(t);
        if (!Number.isFinite(parsed)) return;
        padSampleRootBpmRef.current[k] = Math.round(Math.max(40, Math.min(320, parsed)));
      }
      playPadSoundRef.current(padIndex, PAD_VEL[padIndex] ?? 90);
    } finally {
      if (prevRoot !== undefined) padSampleRootBpmRef.current[k] = prevRoot;
      else delete padSampleRootBpmRef.current[k];
    }
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
        savePadSampleStore(store);
        padSamplePlaybackOptsRef.current[k] = defaultPadSamplerPlaybackOpts();
      } catch (err) {
        console.debug('Pad bounce export failed:', err);
      }
    },
    [activeBank, getOrCreateAudioContext],
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
        savePadSampleStore(store);
        padSamplePlaybackOptsRef.current[k] = defaultPadSamplerPlaybackOpts();
      } catch (err) {
        console.debug('Drum kit generator (single pad) failed:', err);
      } finally {
        setDrumKitGenBusy(false);
      }
    },
    [activeBank, bpm, drumKitGenStyle, ensureCtx],
  );

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
    setTab('grid');
  }, [activeBank, beatsPerBar, drumKitGenStyle, drumStepSubdiv, patternColsDrums, patternSlot]);

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
    setBanks(prev => prev.map((b, i) => i !== activeBank ? b : { ...b, drums: mutate(b.drums) }));
    setBankPatternSlots((prev) =>
      prev.map((slots, i) =>
        i !== activeBank ? slots : { ...slots, [patternSlot]: mutate(slots[patternSlot]) },
      ),
    );
  }

  function setDrumStep(pad: number, col: number, enabled: boolean, slot: PatternSlot = patternSlot) {
    const mutate = (drums: DrumPattern) =>
      drums.map((row, r) => row.map((v, c) => (r === pad && c === col ? enabled : v)));
    setBanks((prev) => prev.map((b, i) => (i !== activeBank ? b : { ...b, drums: mutate(b.drums) })));
    setBankPatternSlots((prev) =>
      prev.map((slots, i) =>
        i !== activeBank ? slots : { ...slots, [slot]: mutate(slots[slot]) },
      ),
    );
  }

  const auditionDrumLane = useCallback((padIndex: number) => {
    setSelectedDrumPad(padIndex);
    playPadSoundRef.current(padIndex, PAD_VEL[padIndex] ?? 90);
  }, []);

  const clearDrumLane = useCallback((padIndex: number) => {
    const startCol = drumColOffset;
    const span = Math.max(1, patternColsDrums);
    const mutate = (drumsIn: DrumPattern) => {
      const drums = drumsIn.map((row) => row.slice());
      for (let c = startCol; c < startCol + span && c < TOTAL_COLS; c += 1) {
        if (drums[padIndex]) drums[padIndex]![c] = false;
      }
      return drums;
    };
    setBanks((prev) =>
      prev.map((b, i) => {
        if (i !== activeBank) return b;
        return { ...b, drums: mutate(b.drums) };
      }),
    );
    setBankPatternSlots((prev) =>
      prev.map((slots, i) =>
        i !== activeBank ? slots : { ...slots, [patternSlot]: mutate(slots[patternSlot]) },
      ),
    );
  }, [activeBank, drumColOffset, patternColsDrums, patternSlot]);

  /** Genius-style “Clear”: wipe drum steps for current bank + A/B slot (structure unchanged). */
  const clearCurrentPatternDrums = useCallback(() => {
    if (!confirm(`Clear drum pattern for bank ${BANKS[activeBank]}, slot ${patternSlot}?`)) return;
    const next = emptyDrums().map((r) => r.slice());
    setBanks((prev) => prev.map((b, i) => (i === activeBank ? { ...b, drums: next.map((row) => row.slice()) } : b)));
    setBankPatternSlots((prev) =>
      prev.map((slots, i) =>
        i !== activeBank ? slots : { ...slots, [patternSlot]: next.map((row) => row.slice()) },
      ),
    );
    setActiveGeniusStarter(null);
  }, [activeBank, patternSlot]);

  const applyStarterPreset = useCallback((preset: CreationStarterPreset) => {
    const next = emptyDrums();
    const startCol = drumColOffset;
    const span = Math.max(1, patternColsDrums);
    const place = (row: number, relStep: number) => {
      const c = startCol + (((relStep % span) + span) % span);
      if (row >= 0 && row < next.length && c >= 0 && c < TOTAL_COLS) next[row]![c] = true;
    };
    const add16thHats = (row: number) => {
      for (let s = 0; s < span; s += 1) place(row, s);
    };
    const add8thHats = (row: number) => {
      for (let s = 0; s < span; s += 2) place(row, s);
    };
    switch (preset) {
      case 'hiphopA':
        add16thHats(0);
        [0, 4, 8, 12].forEach((s) => place(2, s));
        [4, 12].forEach((s) => place(1, s));
        [7, 15].forEach((s) => place(4, s));
        break;
      case 'hiphopB':
        add16thHats(0);
        [0, 6, 8, 14].forEach((s) => place(2, s));
        [4, 12].forEach((s) => place(1, s));
        [3, 11].forEach((s) => place(3, s));
        break;
      case 'rnbA':
        add8thHats(0);
        [0, 7, 10, 14].forEach((s) => place(2, s));
        [4, 12].forEach((s) => place(1, s));
        [8].forEach((s) => place(5, s));
        break;
      case 'rnbB':
        add8thHats(0);
        [0, 5, 8, 11, 14].forEach((s) => place(2, s));
        [4, 12].forEach((s) => place(1, s));
        [2, 10].forEach((s) => place(4, s));
        break;
    }
    setBanks((prev) => prev.map((b, i) => (i === activeBank ? { ...b, drums: next } : b)));
    setBankPatternSlots((prev) =>
      prev.map((slots, i) => (i === activeBank ? { ...slots, [patternSlot]: next.map((r) => r.slice()) } : slots)),
    );
    setActiveGeniusStarter(preset);
  }, [activeBank, drumColOffset, patternColsDrums, patternSlot]);

  const copyPatternAToB = useCallback(() => {
    setBankPatternSlots((prev) =>
      prev.map((slots, i) =>
        i !== activeBank
          ? slots
          : {
              ...slots,
              B: slots.A.map((r) => r.slice()),
            },
      ),
    );
  }, [activeBank]);

  const swapPatternAB = useCallback(() => {
    setBankPatternSlots((prev) =>
      prev.map((slots, i) =>
        i !== activeBank
          ? slots
          : {
              A: slots.B.map((r) => r.slice()),
              B: slots.A.map((r) => r.slice()),
            },
      ),
    );
  }, [activeBank]);
  function toggleNote(row: number, col: number) {
    if (sharedNotes.some(n => n.row === row && n.col === col)) {
      removeSharedNote(row, col);
    } else {
      addSharedNote(row, col);
    }
  }

  // Piano note synthesis — use shared MasterClock AudioContext (same graph as drums/transport).
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

  const hasDrums = (i: number) => banks[i].drums.some(r => r.some(Boolean));
  const hasNotes = (i: number) => banks[i].notes.length > 0;
  const drumGridColW = Math.max(colWidth, DRUM_GRID_MIN_CW);
  const pianoGridColW = Math.max(colWidth, PIANO_GRID_MIN_CW);
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
  /** Sourced from transport HUD (`CreationTransportHudMsr`) via {@link publishCreationRulerBeat} — integer change only. */
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', background: '#060607', color: '#c8c8d0', overflow: 'hidden', position: 'relative' }}>
      <style>{`
        .cs-pad-hit { transition: filter 0.14s ease-out; }
        .cs-pad-hit:active,
        .cs-pad-hit:has(*:active) {
          filter: brightness(1.7) saturate(0.95);
        }
      `}</style>

      {/* ── Top: Genius-style beat lab deck (transport + status) ── */}
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
            title="Elapsed musical time from playhead (m:ss). BAR / MEASURE readout is to the right."
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

          <div
            role="group"
            aria-label={`Bar ${displayBarNumberHud}, beat ${measureInBarHud} of ${Math.max(2, Math.min(16, Math.round(qpb)))}`}
            style={{
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              background: '#000',
              border: `1px solid ${transportNotStopped ? '#00E5FF66' : '#2a2a32'}`,
              borderRadius: 4,
              overflow: 'hidden',
              fontFamily: 'monospace',
              minHeight: 0,
            }}
          >
            {tab !== 'grid' ? (
              <CreationTransportHudBar
                transportNotStopped={transportNotStopped}
                displayBarNumber={displayBarNumberHud}
                measureInBar={measureInBarHud}
                measureLedCount={Math.max(2, Math.min(16, Math.round(qpb)))}
                paintHudFromRaf={isPlaybackOrRecord}
                hudDomSlotsRef={creationHudDomRef}
              />
            ) : null}
            <CreationTransportHudMsr
              qpb={qpb}
              measureInBar={measureInBarHud}
              phraseEveryFourMeasures={phraseEveryFourMeasuresHud}
              debugText={hudDebugText}
              paintHudFromRaf={isPlaybackOrRecord}
              hudDomSlotsRef={creationHudDomRef}
            />
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
              title="Drag to set tempo — 40–240 BPM"
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
                seekBeats(0);
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
            title="Snap / loop / length / click timing / zoom — scroll horizontally if the window is narrow"
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
              <span style={{ fontSize: 8, color: '#6a6a78', fontWeight: 700 }}>SNAP</span>
              <select
                value={normalizePianoSnapSubdiv(pianoSnapSubdiv)}
                title={`Snap — ${PPQ} PPQ; one column = ${Math.round(ticksPerPianoSnapCell(PPQ, normalizePianoSnapSubdiv(pianoSnapSubdiv)))} ticks at this grid; zoom changes pixel width`}
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

            <button
              type="button"
              aria-pressed={loopOn}
              title={
                loopOn
                  ? `Loop on — ${loopBars} bar${loopBars !== 1 ? 's' : ''}`
                  : 'Loop off — click to enable'
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

            <div
              style={{
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                gap: 5,
                flexShrink: 0,
                minWidth: 0,
              }}
              title="Loop length (bars) — dropdown; 64 = full board"
            >
              <span style={{ fontSize: 8, color: '#6a6a78', fontWeight: 700 }}>LEN</span>
              <select
                value={loopBars}
                title="Loop length (bars) — same preset set as Studio; 64 = full piano board span"
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
                    {n} bar{n !== 1 ? 's' : ''}{n === 64 ? ' · full' : ''}
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

        {/* Beat Lab: presets · record/upload · kit+clear+download strip · sampler pads — elevated so FX popover stacks above sequencer / modules */}
        {tab === 'grid' && (
          <div style={{ position: 'relative', zIndex: 200, overflow: 'visible' }}>
          <BeatLabDeckToolbar
            kit={kit}
            setKit={setKit}
            hasPadSample={hasPadSampleForActiveBank}
            onLoadPadSample={beginLoadPadSample}
            onClearPadSample={clearPadSample}
            geniusStarterActive={activeGeniusStarter}
            onGeniusStarter={(k) => {
              applyStarterPreset(k);
            }}
            onGeniusRecord={() => {
              if (CREATION_BACKEND_BLANK) return;
              void startTransport('record');
            }}
            onGeniusUpload={() => beginLoadPadSample(geniusSamplerTargetPad)}
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
            onPreviewSamplerRootBpmDraft={previewSamplerRootBpmDraft}
            getPadSampleAudioBuffer={(pi) => padSampleBuffersRef.current.get(padSampleKey(activeBank, pi))}
            patternActionsDisabled={CREATION_BACKEND_BLANK}
            onClearPattern={() => {
              clearCurrentPatternDrums();
            }}
            onDownloadHandoff={() => {
              onExport('studio-editor');
            }}
          />
          </div>
        )}

        {/* Pattern bank + sound families + session / click timing / zoom — tempo lives in top transport row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'stretch',
            gap: 10,
            flexWrap: 'wrap',
            padding: '4px 2px 0',
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              flex: '1.2 1 320px',
              minWidth: 280,
              padding: '8px 10px',
              borderRadius: 10,
              border: '1px solid rgba(124, 244, 198, 0.22)',
              background: 'linear-gradient(165deg, rgba(11, 11, 16, 0.55) 0%, rgba(8, 8, 12, 0.95) 100%)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ fontSize: 10, color: '#7cf4c6', fontWeight: 800, letterSpacing: 0.8 }}>PATTERN BANK</span>
              <span style={{ fontSize: 9, color: '#6a6a78', fontFamily: 'monospace' }}>A/B · chain · starters · length</span>
            </div>
            <div
              style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}
              title="Starter patterns and arrangement length shortcuts"
            >
            <span style={{ fontSize: 8, color: '#7d87a2', fontWeight: 700 }}>SLOTS</span>
            {(['A', 'B'] as const).map((slot) => (
              <button
                key={slot}
                type="button"
                onClick={() => setPatternSlot(slot)}
                style={{
                  height: 24,
                  minWidth: 24,
                  borderRadius: 4,
                  border: `1px solid ${patternSlot === slot ? '#7cf4c688' : '#2a2a32'}`,
                  background: patternSlot === slot ? '#153126' : '#0c0c12',
                  color: patternSlot === slot ? '#7cf4c6' : '#9dc6ff',
                  fontSize: 10,
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                {slot}
              </button>
            ))}
            <button
              type="button"
              onClick={copyPatternAToB}
              style={{
                height: 24,
                padding: '0 6px',
                borderRadius: 4,
                border: '1px solid #2a2a32',
                background: '#0c0c12',
                color: '#9dc6ff',
                fontSize: 8,
                fontWeight: 700,
                cursor: 'pointer',
              }}
              title="Copy Pattern A into Pattern B"
            >
              A→B
            </button>
            <button
              type="button"
              onClick={swapPatternAB}
              style={{
                height: 24,
                padding: '0 6px',
                borderRadius: 4,
                border: '1px solid #2a2a32',
                background: '#0c0c12',
                color: '#9dc6ff',
                fontSize: 8,
                fontWeight: 700,
                cursor: 'pointer',
              }}
              title="Swap Pattern A and Pattern B"
            >
              A↔B
            </button>
            <button
              type="button"
              onClick={() => setPatternPlayMode((m) => (m === 'single' ? 'chainAB' : 'single'))}
              style={{
                height: 24,
                padding: '0 8px',
                borderRadius: 4,
                border: `1px solid ${patternPlayMode === 'chainAB' ? '#7cf4c688' : '#2a2a32'}`,
                background: patternPlayMode === 'chainAB' ? '#153126' : '#0c0c12',
                color: patternPlayMode === 'chainAB' ? '#7cf4c6' : '#9dc6ff',
                fontSize: 8,
                fontWeight: 800,
                cursor: 'pointer',
              }}
              title="Pattern playback mode"
            >
              {patternPlayMode === 'chainAB' ? 'A+B Chain' : 'Single'}
            </button>
            <span style={{ fontSize: 8, color: '#7d87a2', fontWeight: 700 }}>STARTERS</span>
            {([
              ['Hip-Hop A', 'hiphopA'],
              ['Hip-Hop B', 'hiphopB'],
              ['R&B A', 'rnbA'],
              ['R&B B', 'rnbB'],
            ] as const).map(([label, key]) => (
              <button
                key={key}
                type="button"
                onClick={() => applyStarterPreset(key)}
                style={{
                  height: 24,
                  padding: '0 8px',
                  borderRadius: 4,
                  border: '1px solid #2a2a32',
                  background: '#0c0c12',
                  color: '#9dc6ff',
                  fontSize: 9,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {label}
              </button>
            ))}
            <span style={{ marginLeft: 4, fontSize: 8, color: '#7d87a2', fontWeight: 700 }}>LEN</span>
            {[16, 32].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => {
                  setLoopBars(n);
                  setLoopRangeBeats(
                    loopStartBeatRef.current,
                    loopStartBeatRef.current + n * beatsPerBarRef.current,
                  );
                }}
                style={{
                  height: 24,
                  minWidth: 36,
                  padding: '0 6px',
                  borderRadius: 4,
                  border: `1px solid ${loopBars === n ? '#00E5FF66' : '#2a2a32'}`,
                  background: loopBars === n ? '#11202a' : '#0c0c12',
                  color: loopBars === n ? '#00E5FF' : '#9dc6ff',
                  fontSize: 9,
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                {n}
              </button>
            ))}
          </div>
          </div>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              flex: '1 1 220px',
              minWidth: 200,
              padding: '8px 10px',
              borderRadius: 10,
              border: '1px solid rgba(52, 211, 153, 0.18)',
              background: 'linear-gradient(165deg, rgba(6, 40, 32, 0.35) 0%, rgba(8, 8, 10, 0.95) 100%)',
            }}
            title="Sound families — match pads to kick, hats, 808, etc."
          >
            <span style={{ fontSize: 10, color: '#6ee7b7', fontWeight: 800, letterSpacing: 0.6 }}>SOUND FAMILIES</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 8, color: '#666', fontWeight: 700 }}>TAGS</span>
            {[
              'Kick',
              'Snare/Clap',
              'Hi-Hat',
              'Open Hat',
              '808/Sub',
              'Perc',
              'Riser/FX',
            ].map((label) => (
              <span
                key={label}
                style={{
                  padding: '3px 8px',
                  borderRadius: 999,
                  border: '1px solid rgba(45, 212, 191, 0.22)',
                  background: 'rgba(15, 30, 28, 0.6)',
                  fontSize: 8,
                  color: '#a7f3d0',
                  fontFamily: 'monospace',
                }}
              >
                {label}
              </span>
            ))}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '8px 6px', borderRadius: 8, border: '1px solid #2a2a32', background: '#090909' }} title="Creation patterns sync to the DAW session when you arrange or open Studio">
            <span style={{ fontSize: 8, color: '#6a6a78', fontFamily: 'monospace', letterSpacing: 0.5 }}>SESSION</span>
            <span style={{ fontSize: 9, color: '#666', fontFamily: 'monospace', fontWeight: 700 }}>LINKED</span>
          </div>

          {/* Zoom */}
          <div style={{ display: 'flex', alignItems: 'center', background: '#0a0a0e', border: '1px solid #2a2a32', borderRadius: 4, overflow: 'hidden' }}>
            <button onClick={zoomOut} style={{ padding: '3px 7px', background: 'none', border: 'none', color: '#666', cursor: 'pointer' }}><ZoomOut size={11} /></button>
            <span style={{ padding: '0 6px', fontFamily: 'monospace', fontSize: 10, color: '#4a4a58', borderLeft: '1px solid #2a2a32', borderRight: '1px solid #2a2a32' }}>{colWidth}px</span>
            <input
              type="range"
              min={MIN_CW}
              max={MAX_CW}
              step={1}
              value={colWidth}
              onChange={(e) => setColWidth(Number(e.target.value))}
              style={{ width: 92, height: 4, margin: '0 6px', accentColor: '#00E5FF', cursor: 'ew-resize' }}
              title="Drag to zoom grid in/out"
            />
            <button onClick={zoomIn} style={{ padding: '3px 7px', background: 'none', border: 'none', color: '#666', cursor: 'pointer' }}><ZoomIn size={11} /></button>
            <button onClick={zoomReset} style={{ padding: '3px 7px', background: 'none', border: 'none', color: '#666', cursor: 'pointer', borderLeft: '1px solid #2a2a32' }}><Maximize2 size={11} /></button>
            <button
              onClick={fitDrumGridToLoop}
              style={{ padding: '3px 8px', background: 'none', border: 'none', color: '#7aa2b8', cursor: 'pointer', borderLeft: '1px solid #2a2a32', fontSize: 10, fontFamily: 'monospace', fontWeight: 700 }}
              title={`Fit ${loopBars} bar${loopBars !== 1 ? 's' : ''} to screen`}
            >
              FIT
            </button>
          </div>

          {/* Follow */}
          <button onClick={() => setFollow(p => !p)} style={{ padding: '3px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700, fontFamily: 'monospace', background: follow ? '#00E5FF18' : '#1a1a24', color: follow ? '#00E5FF' : '#4a4a58', border: `1px solid ${follow ? '#00E5FF44' : '#2a2a32'}`, cursor: 'pointer' }}>
            ⊳ FOLLOW
          </button>

          {/* Banks */}
          <BankButtons activeBank={activeBank} setActiveBank={setActiveBank} hasDrums={hasDrums} hasNotes={hasNotes} />

          <button type="button" disabled={CREATION_BACKEND_BLANK} onClick={() => {
            if (CREATION_BACKEND_BLANK) return;
            onExport('master-arranger');
          }} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700, background: '#1a1a24', color: '#7cf4c6', border: '1px solid rgba(124,244,198,0.27)', cursor: CREATION_BACKEND_BLANK ? 'not-allowed' : 'pointer', opacity: CREATION_BACKEND_BLANK ? 0.45 : 1 }}>
            <Send size={9} /> Arrange
          </button>
        </div>
      </div>

      <input
        ref={padSampleFileInputRef}
        type="file"
        accept="audio/*"
        style={{ display: 'none' }}
        onChange={handlePadSampleFile}
      />

      {/* ── Tab bar (Beat Lab = main drum + sampler + sequence workspace) ── */}
      <div style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid #141418', flexShrink: 0, background: '#09090c' }}>
        {(['grid', 'chord', 'drums'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            style={{
              padding: '8px 18px',
              fontSize: 11,
              fontWeight: 700,
              background: tab === t ? 'rgba(124, 244, 198, 0.12)' : 'transparent',
              color: tab === t ? '#7cf4c6' : '#6a6a78',
              borderBottom: tab === t ? `2px solid ${t === 'grid' ? '#a8e8d0' : '#7cf4c6'}` : '2px solid transparent',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            {t === 'grid'
              ? '🎛 BEAT LAB'
              : t === 'chord'
                ? '🎼 CHORD BUILDER'
                : '✦ MORE'}
          </button>
        ))}
        <div style={{ width: 1, alignSelf: 'stretch', margin: '6px 4px', background: 'rgba(124, 244, 198, 0.2)', flexShrink: 0 }} aria-hidden />
        <button
          type="button"
          onClick={() => setDrumKitGenOpen(true)}
          disabled={CREATION_BACKEND_BLANK}
          title="Drum kit generator — single pads or full kit + pattern for Beat Lab"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 12px',
            marginLeft: 2,
            borderRadius: 6,
            border: '1px solid rgba(124, 244, 198, 0.35)',
            background: 'rgba(124, 244, 198, 0.1)',
            color: '#7cf4c6',
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: 0.3,
            cursor: CREATION_BACKEND_BLANK ? 'not-allowed' : 'pointer',
            opacity: CREATION_BACKEND_BLANK ? 0.45 : 1,
          }}
        >
          <Zap size={12} aria-hidden />
          <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1.15 }}>
            <span>DRUM KIT</span>
            <span style={{ fontSize: 8, fontWeight: 800, opacity: 0.9 }}>GENERATOR</span>
          </span>
        </button>
        <button
          type="button"
          onClick={() => setTab('chord')}
          title="Chord Builder — genre packs, suggest-next, writes MIDI to the Piano Roll"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 12px',
            marginLeft: 4,
            borderRadius: 6,
            border: '1px solid rgba(124, 244, 198, 0.35)',
            background: 'rgba(124, 244, 198, 0.1)',
            color: '#7cf4c6',
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: 0.3,
            cursor: 'pointer',
          }}
        >
          <Music2 size={12} aria-hidden />
          <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1.15 }}>
            <span>CHORD</span>
            <span style={{ fontSize: 8, fontWeight: 800, opacity: 0.9 }}>BUILDER</span>
          </span>
        </button>
        <button
          type="button"
          onClick={() => setTab('ai-pattern')}
          title="AI Pattern Generator — drum/melody patterns with Magenta RNN, export to a sampler pad"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 12px',
            marginLeft: 4,
            borderRadius: 6,
            border: '1px solid rgba(0, 229, 255, 0.4)',
            background: 'rgba(0, 229, 255, 0.1)',
            color: '#00E5FF',
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: 0.3,
            cursor: 'pointer',
          }}
        >
          <Cpu size={12} aria-hidden />
          <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1.15 }}>
            <span>AI</span>
            <span style={{ fontSize: 8, fontWeight: 800, opacity: 0.9 }}>PATTERN</span>
          </span>
        </button>
        <button
          type="button"
          onClick={() => setTab('chord-seq')}
          title="Chord/Bass Sequencer — 16 chord pads with suitability lighting, step sequencer, painted bass line, MIDI out + WAV/MIDI export"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 12px',
            marginLeft: 4,
            borderRadius: 6,
            border: `1px solid ${tab === 'chord-seq' ? 'rgba(34,197,94,0.6)' : 'rgba(34,197,94,0.25)'}`,
            background: tab === 'chord-seq' ? 'rgba(34,197,94,0.15)' : 'rgba(34,197,94,0.06)',
            color: '#22c55e',
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: 0.3,
            cursor: 'pointer',
          }}
        >
          🎹
          <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1.15 }}>
            <span>CHORD/BASS</span>
            <span style={{ fontSize: 8, fontWeight: 800, opacity: 0.9 }}>SEQUENCER</span>
          </span>
        </button>
      </div>

      {/* ── MORE (placeholder — former Drums tab; primary workflow is Beat Lab) ── */}
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
            onClick={() => setTab('grid')}
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

      {/* ── Chord Builder (SongEngine-style chord-pad rail + bar timeline) ── */}
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
        onClose={() => setTab('grid')}
        onExportToPad={onPadBounceExport}
      />

      {/* ── AI Pattern Generator (embedded as a Creation Station tab) ──
          Mounted only when active so its Magenta prefetch, transport-pulse
          worker, and session-sync effects don't run while the user is in
          Beat Lab. State (generated patterns + lane names) persists
          across tab switches via localStorage. Independent BPM — does NOT
          drive or follow Beat Lab transport.

          Renders as a full-viewport overlay (`position: absolute, inset:
          0, zIndex: 3500`) just like Chord Builder so the AI Pattern UI
          fills the whole Creation Station area instead of being squeezed
          into the remaining flex slot between Beat Lab's chrome. */}
      {tab === 'ai-pattern' && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 3500,
            background: '#050505',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <AiPatternScreen
            embedded
            isScreenActive={tab === 'ai-pattern'}
            onBack={() => setTab('grid')}
            onExport={() => { /* Embedded mode uses → PAD button; classic export modal still works. */ }}
            onExportToPad={onPadBounceExport}
          />
        </div>
      )}

      {/* ── Chord Sequencer overlay ── */}
      {tab === 'chord-seq' && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 3500, background: '#030303', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <ChordSequencerScreen
            embedded
            isScreenActive={tab === 'chord-seq'}
            onBack={() => setTab('grid')}
            onExportToPad={onPadBounceExport}
            bpm={bpm}
            getAudioContext={getOrCreateAudioContext}
          />
        </div>
      )}

      {/* ── Beat Lab sequencer (sampler deck is under transport · BeatLabDeckToolbar) ── */}
      {tab === 'grid' && (
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0, background: '#050505' }}>
          {/* Sequence + lane rail only — sampler / uploads live under transport (BeatLabDeckToolbar) */}
          <div
            style={{
              flex: 1,
              minWidth: 0,
              display: 'flex',
              flexDirection: 'column',
              minHeight: 0,
              background: '#070708',
              boxShadow: 'inset 0 1px 0 rgba(124, 244, 198, 0.08)',
            }}
          >
            <div
              style={{
                flexShrink: 0,
                padding: '6px 10px',
                borderBottom: '1px solid rgba(124, 244, 198, 0.12)',
                background: 'linear-gradient(180deg, rgba(20, 20, 26, 0.95) 0%, rgba(10, 10, 14, 0.98) 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
                minWidth: 0,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flexShrink: 0 }}>
                <span style={{ fontSize: 11, fontWeight: 900, color: '#7cf4c6', letterSpacing: 3 }}>SEQUENCE</span>
                <span style={{ fontSize: 9, color: '#6a6a78', fontWeight: 700 }}>
                  Lanes 1–16 = sampler pads 1–16 · paint steps
                </span>
              </div>
              {/* Studio Editor 2 transport chips — same Bars / Time readouts as `StudioEditor2Screen` (~7902–7931). */}
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 12,
                  minWidth: 0,
                }}
              >
                <div
                  style={{
                    height: 32,
                    borderRadius: 4,
                    border: '1px solid #2a2a32',
                    padding: '0 8px',
                    boxSizing: 'border-box',
                    background: 'rgba(0,0,0,0.45)',
                    minWidth: 132,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}
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
                    ref={creationSe2BarsReadoutRef}
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
                <div
                  style={{
                    height: 32,
                    borderRadius: 4,
                    border: '1px solid #2a2a32',
                    padding: '0 6px',
                    boxSizing: 'border-box',
                    background: 'rgba(0,0,0,0.45)',
                    minWidth: 56,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}
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
                    ref={creationSe2TimeReadoutRef}
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
              </div>
              <CreationTransportHudBar
                compact
                transportNotStopped={transportNotStopped}
                displayBarNumber={displayBarNumberHud}
                measureInBar={measureInBarHud}
                measureLedCount={Math.max(2, Math.min(16, Math.round(qpb)))}
                paintHudFromRaf={isPlaybackOrRecord}
                hudDomSlotsRef={creationHudDomRef}
              />
            </div>
            <div style={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden' }}>
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
                height: 20,
                flexShrink: 0,
                borderBottom: '1px solid #1e1e1e',
                background: '#080808',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span style={{ fontSize: 10, fontWeight: 900, color: '#7cf4c6', letterSpacing: 1.4 }}>MEASURES</span>
            </div>
            <div
              style={{
                height: 28,
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
                  height: 14,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 10,
                  fontWeight: 900,
                  color: '#9ec7d4',
                  letterSpacing: 1.2,
                  borderBottom: '1px solid #1e1e1e',
                }}
              >
                BARS
              </div>
              <div
                style={{
                  height: 14,
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
              const laneText =
                padSampleLabels[padSampleKey(activeBank, pi)]?.trim() || GENIUS_LANE_LABELS[pi];
              return (
              <div
                key={pi}
                style={{
                  height: DRUM_GRID_ROW_H,
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  padding: '3px 6px',
                  textAlign: 'left',
                  borderTop: '1px solid #1c1c20',
                  borderBottom: '1px solid #2a2a32',
                  background: pi === selectedDrumPad ? '#1c1c24' : '#0c0c12',
                  borderLeft: pi === selectedDrumPad ? '3px solid rgba(255, 255, 255, 0.40)' : '3px solid transparent',
                  boxShadow: pi === selectedDrumPad ? 'inset 0 0 0 1px rgba(255, 255, 255, 0.20)' : 'none',
                  borderRadius: 0,
                  overflow: 'visible',
                  boxSizing: 'border-box',
                }}
              >
                <button
                  type="button"
                  className="cs-pad-hit"
                  onClick={() => auditionDrumLane(pi)}
                  style={{
                    width: '100%',
                    height: '100%',
                    borderRadius: 10,
                    border: `1px solid ${pi === selectedDrumPad ? 'rgba(255, 255, 255, 0.28)' : 'rgba(255,255,255,0.12)'}`,
                    backgroundColor: 'rgba(4, 5, 6, 0.95)',
                    backgroundImage: [
                      'radial-gradient(ellipse 75% 55% at 26% 12%, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.05) 38%, transparent 70%)',
                      'linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.01) 45%, rgba(0,0,0,0.30) 100%)',
                    ].join(', '),
                    backdropFilter: 'blur(8px)',
                    WebkitBackdropFilter: 'blur(8px)',
                    color: '#e8e8f0',
                    fontSize: 13,
                    fontWeight: 800,
                    fontFamily: 'monospace',
                    cursor: 'pointer',
                    padding: '0 12px 0 30px',
                    textAlign: 'left',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    position: 'relative',
                    textShadow: '0 1px 2px rgba(0,0,0,0.6)',
                    boxShadow: [
                      '0 2px 4px rgba(0,0,0,0.55)',
                      '0 1px 0 rgba(0,0,0,0.40)',
                      `inset 0 1px 0 rgba(255,255,255,${pi === selectedDrumPad ? '0.28' : '0.20'})`,
                      'inset 0 2px 5px rgba(255,255,255,0.04)',
                      'inset 0 -2px 8px rgba(0,0,0,0.55)',
                      'inset 0 -1px 0 rgba(0,0,0,0.65)',
                      'inset 0 0 0 1px rgba(255,255,255,0.03)',
                    ].join(', '),
                  }}
                  title={`Beat Lab lane ${pi + 1} = sampler pad ${pi + 1} — ${laneText}`}
                >
                  <span
                    aria-hidden
                    style={{
                      position: 'absolute',
                      top: 3,
                      left: 8,
                      fontSize: 11,
                      fontWeight: 900,
                      color: 'rgba(255, 255, 255, 0.70)',
                      letterSpacing: 0.6,
                      fontFamily: 'monospace',
                      lineHeight: 1,
                      pointerEvents: 'none',
                      textShadow: '0 1px 2px rgba(0,0,0,0.7)',
                    }}
                  >
                    {pi + 1}
                  </span>
                  {laneText}
                </button>
              </div>
            );
            })}
          </div>

          {/* RIGHT: drum grid — horizontal = timeline, vertical synced with lane rail */}
          <div
            ref={drumScrollRef}
            onScroll={onGeniusPatternScroll}
            onWheel={(e) => {
              if (!(e.ctrlKey || e.metaKey)) return;
              e.preventDefault();
              if (e.deltaY < 0) zoomIn();
              else if (e.deltaY > 0) zoomOut();
            }}
            style={{ flex: 1, overflowX: 'auto', overflowY: 'auto', background: '#050505', minWidth: 0 }}
          >
            <div ref={drumGridContentRef} style={{ width: drumGridW, minWidth: drumGridW, position: 'relative' }}>
              <div
                ref={drumPlaylineRef}
                aria-hidden
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  /** Match `CREATION_DRUM_PLAYLINE_CENTER_X` in `creationPlaylineWapi` so column hit-tests align with motion. */
                  width: 2,
                  height: 48 + PAD_NAMES.length * DRUM_GRID_ROW_H,
                  background: 'transparent',
                  pointerEvents: 'none',
                  /** Above sticky quant row (`zIndex` 20) so the playhead arrow can meet the number boxes. */
                  zIndex: 22,
                  /** Stopped: dimmed so column 0 / count “1” anchor is still visible; playing/recording full opacity. */
                  opacity: transportNotStopped ? 1 : 0.42,
                }}
              >
                {/** Tip at y=0, base at y=20 — flush with bottom of sticky quant strip (same `height: 20` as measure row). */}
                <span
                  aria-hidden
                  style={{
                    position: 'absolute',
                    left: '50%',
                    top: 0,
                    width: 10,
                    height: 20,
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
                    top: 20,
                    width: 2,
                    height: 28 + PAD_NAMES.length * DRUM_GRID_ROW_H,
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
                  height: 20,
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
                    height: 20,
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
                      height: 20,
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                  {Array.from({ length: patternColsDrums }, (_, i) => {
                    const colsPB = Math.max(1, qpbHud * subdivHud);
                    const bankCol = i + drumColOffset;
                    /** Fixed step-in-bar label per column (1…colsPB); only the playhead arrow moves during play. */
                    const mod = ((bankCol % colsPB) + colsPB) % colsPB;
                    const quantStepInBar = mod + 1;
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
                          /** Same left-edge model as pad cells — full box border was stealing horizontal space and drifting labels vs playhead. */
                          borderLeft: `1px solid ${creationDrumGridVerticalLineColor({
                            colWidthPx: drumGridColW,
                            bankCol,
                            qpb: qpbHud,
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
                        {quantStepInBar}
                      </div>
                    );
                  })}
                  </div>
                </div>
              </div>
              <div
                style={{
                  position: 'sticky',
                  top: 20,
                  zIndex: 20,
                  display: 'flex',
                  height: 28,
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
                  stepsPerBar={qpbHud * subdivHud}
                  barStepCounts={creationDrumRulerCounts}
                  segmentHeaderLabels={creationDrumRulerHeaderLabels}
                  patternColToDawBar={drumPatternColToDawBar}
                  creationBeatHighlight={null}
                  creationBeatsPerBar={qpbHud}
                  creationStepSubdiv={subdivHud}
                  disablePlayheadHighlight
                  drumGridBeatBorders={{
                    bankColOffset: drumColOffset,
                    qpb: qpbHud,
                    subdiv: subdivHud,
                  }}
                  onSeekPatternCol={CREATION_BACKEND_BLANK ? undefined : seekTransportToPatternColumn}
                />
                <LoopMarkersBrace
                  visible={loopEnabled}
                  leftPx={0}
                  widthPx={drumGridW}
                  height={28}
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
                    background: pi === selectedDrumPad ? '#1c1c24' : '#0c0c12',
                    cursor: 'pointer',
                    boxShadow: pi === selectedDrumPad ? 'inset 0 0 0 1px rgba(255, 255, 255, 0.18)' : 'none',
                    position: 'relative',
                    zIndex: 1,
                  }}
                  onClick={() => auditionDrumLane(pi)}
                >
                  {Array.from({ length: patternColsDrums }, (_, ci) => {
                    const bankCol = ci + drumColOffset;
                    const on     = currentDrums[pi]?.[bankCol] ?? false;
                    const isHead = false;
                    const padStepBg = on
                      ? '#0e0e10'
                      : (bankCol % subdivHud === 0 ? '#08080a' : '#050506');
                    return (
                      <button
                        key={ci}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!CREATION_BACKEND_BLANK && (e.ctrlKey || e.metaKey)) {
                            seekTransportToPatternColumn(ci);
                            return;
                          }
                          toggleDrum(pi, bankCol);
                        }}
                        style={{
                          width: drumGridColW,
                          boxSizing: 'border-box',
                          flexShrink: 0,
                          height: DRUM_GRID_ROW_H,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: padStepBg,
                          borderLeft: `1px solid ${creationDrumGridVerticalLineColor({
                            colWidthPx: drumGridColW,
                            bankCol,
                            qpb: qpbHud,
                            subdiv: subdivHud,
                            blendTo: padStepBg,
                          })}`,
                          borderTop: 'none',
                          borderRight: 'none',
                          borderBottom: `1px solid ${creationDrumGridStepBottomBorder(drumGridColW)}`,
                          boxShadow: 'none',
                          cursor: 'pointer',
                          transition: isHead ? 'none' : 'background 0.04s',
                          padding: 0,
                          borderRadius: 0,
                        }}
                        title={CREATION_BACKEND_BLANK ? undefined : 'Ctrl+click: move playhead · click: toggle step'}
                      >
                        {on && (
                          <div
                            style={{
                              width: Math.max(12, Math.floor(drumGridColW * 0.72)),
                              height: Math.floor(DRUM_GRID_ROW_H * 0.72),
                              borderRadius: 4,
                              background: 'linear-gradient(180deg, #4a4a4a, #343434)',
                              border: '1px solid rgba(18, 18, 18, 0.65)',
                              boxShadow: '0 0 8px rgba(80, 80, 80, 0.45)',
                            }}
                          />
                        )}
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
      )}

      {/* ── PIANO ROLL TAB ── */}
      {tab === 'piano' && (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', minHeight: 0 }}>
          {/* Sub-tab + instruments */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', flexShrink: 0, background: '#080808', borderBottom: '1px solid #1a1a1a' }}>
            {(['notes','drums'] as const).map(st => (
              <button key={st} onClick={() => setPianoMode(st)} style={{ padding: '3px 10px', borderRadius: 4, fontSize: 10, fontWeight: 700, background: pianoMode===st ? '#193025' : '#1a1a24', color: pianoMode===st ? '#7cf4c6' : '#6a6a78', border: `1px solid ${pianoMode===st ? 'rgba(124,244,198,0.45)' : '#2a2a32'}`, cursor: 'pointer' }}>
                {st === 'notes' ? '🎵 Notes' : '🥁 Drums'}
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
              <div style={{ height: 28, flexShrink: 0, borderBottom: '1px solid #1e1e1e', background: '#050505' }} />
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
                          color: PAD_COLORS[padIndex] ?? '#aeb7be',
                          background: drumLaneBg(padIndex),
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
                        background: pianoMode === 'drums' ? drumLaneBg(padIndex) : pianoLaneBg(ri),
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
