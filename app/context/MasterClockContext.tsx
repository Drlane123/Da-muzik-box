/**
 * MasterClockContext — Universal Master Clock for Da Music Box
 *
 * ⚙️ UNIFIED SYNC ARCHITECTURE:
 *
 * • INDEPENDENT MODULES: Each screen (Creation Station, Studio, Piano Roll, AI Pattern, …) keeps its own
 *   UI state, editors, and data — nothing requires another tab to be “in charge.” What is **shared** is only
 *   the clock: `useMasterClock()` + one `AudioContext` graph for tempo, transport, and scheduled audio.
 * • SINGLE TIMEBASE: Transport tick + bar/beat are driven only from AudioContext.currentTime (+ anchors);
 *   requestAnimationFrame publishes display state for painting — not used as an oscillator or time integrator.
 * • HYBRID SCHEDULER: rAF publishes display/UI only; `TransportPulseWorker` wakes main for metronome + MIDI clock lookahead.
 * • METRONOME: `runMetronomeScheduler` runs on a ~25ms worker pulse (+ initial call from `startMetronomeLoop`) so React-heavy
 *   frames cannot drain the click lookahead buffer; `metronomeSchedulerRunIdRef` invalidates stale callbacks on stop.
 *   (`playStartTimeRef` / `originBeatFloatRef` / AudioContext.currentTime), not from a looping buffer
 * • CREATION STATION AS LOOP ANCHOR: Session loop length/start (for wrap + drums) is stored against the
 *   Creation Station profile row (`loopProfiles['creation-station']`), kept in sync across modules via
 *   `applyLoopPatchAll` — not “CS owns other screens,” only one agreed loop window for the shared clock.
 * • LOOP WRAP ANCHOR: `wrapGlobalTickToDisplayTick` uses that same Creation Station profile slice for refs,
 *   so bar-phase and metronome accents stay aligned app-wide.
 * • ZERO DRIFT: Transport tick = inverse of `mapGlobalTickToAudioTime` (elapsed AudioContext time).
 * • NO SHADOW CLOCKS: Any musical step, preview, or scheduled note must use this timebase
 *   (`getTickIntAtAudioNow`, `positionTicks`, `transportBeatIndex`, `wrapGlobalTickToDisplayTick`,
 *   `getOrCreateAudioContext`) — not `setInterval(…, 60000/bpm)` or a second `AudioContext` for tempo.
 *
 * TIMING GUARANTEES:
 * - **Single transport truth:** hardware phase `originBeatFloat + (audioCtx.currentTime - sessionStart) * bpm / 60`
 *   (quarter beats), then `round(· * PPQ)` for integer ticks — no transport `measure++` accumulation.
 *   Loop display: `wrapGlobalBeatsToDisplayFloat`; metronome uses the same tick map / `wrapGlobalTickToDisplayTick`.
 * - Playhead UI, bar/beat counters, grid, sub-steps: all derived from `transportBeatFloat` (React state ~60fps + `transportBeatFloatRef` every RAF).
 * - Beat scheduling: metronome + MIDI lookahead use the same small worker interval on the main thread scheduler.
 * - Metronome: same audio-time anchor as transport; refills from the pulse worker, not from the display rAF.
 * - Do not drive playhead from CSS animation or a second clock — use `transportBeatFloat`.
 *
 * CONSUMPTION:
 * Export: const { currentBar, songBar, playheadFrac, transport, bpm } = useMasterClock()
 * All returned values update at least 60fps and are guaranteed in sync.
 *
 * FIXES APPLIED:
 * - currentBeat uses currentBeatInBar (1–4), not raw tick value
 * - currentTick is beat-within-bar (0–3), not ticks-mod-bar
 * - No parallel “display” timing refs — bar/beat/playhead derive only from `transportBeatFloat`
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useSettings } from '@/app/context/SettingsContext';

export type {
  PPQType,
  SampleRate,
  MIDIValue,
  MIDINote,
  AutomationEvent,
  AutomationMap,
  Track,
  Transport,
  TimeSignature,
  TimeSigDenominator,
  ProjectConfig,
  DAWSession,
  QuantizeGrid,
} from './daw-types';

export {
  clampMIDI,
  snapToGrid,
  applySwing,
  bpmAtTick,
  clampNoteLength,
  createDefaultSession,
  quantizeGridToTicks,
  quantizeTickToNearestGrid,
  ticksToSeconds as ticksToSecondsUtil,
  secondsToTicks as secondsToTicksUtil,
  tickToBarBeat as tickToBarBeatUtil,
} from './daw-types';

import {
  ticksToSeconds as dawTicksToSecs,
  secondsToTicks as dawSecsToTicks,
  tickToBarBeat as dawTickToBarBeat,
  tickToBarBeatFromFloatTick as dawTickToBarBeatFromFloat,
  quantizeGridToTicks,
} from './daw-types';


import TransportPulseWorker from '@/app/workers/transportPulse.worker?worker';

export const PPQ = 960 as const;

/** Fractional quarter-note beat from an integer (loop-wrapped) tick — avoids `tick/PPQ` FP jitter at large positions. */
export function transportBeatFloatFromDisplayTick(displayTick: number): number {
  const q = Math.floor(displayTick / PPQ);
  return q + (displayTick - q * PPQ) / PPQ;
}

/** Throttle for {@link debugTransportSyncTruth} when driven from RAF. */
let __daTransportDebugLastLogMs = 0;

/**
 * **Truth debugger** — paste-style 4/4 math vs DAW time-sig output.
 * - If `Elapsed Since Session Start` snaps to ~0 every frame: `sessionStartTime` is being reset in the loop (should only re-anchor on play / pause / BPM / seek).
 * - If naive bar skips but Truth tracks DAW: BPM unstable or origin wrong — compare `Origin Beats` after seek.
 * - If `4-Bar Group` advances every 2 bars: find a `/ 2` phrase divisor (expect `/ 4`).
 *
 * `AudioContext.currentTime` is in **seconds**, not sample frames — 44.1 kHz vs 48 kHz does not drift this clock.
 *
 * Dev RAF hook: `window.__DA_DEBUG_TRANSPORT__ = true` (throttled ~4 Hz). Or call this from your own loop.
 */
export function debugTransportSyncTruth(opts: {
  audioCtx: AudioContext;
  sessionStartTime: number;
  bpm: number;
  originBeats: number;
  totalBeatsUnwrapped: number;
  displayBeats: number;
  dawBar: number;
  dawBeatInBar: number;
  phraseBars?: number;
}): void {
  const now = opts.audioCtx.currentTime;
  const elapsed = Math.max(0, now - opts.sessionStartTime);
  const bpm = Math.max(1, opts.bpm);
  const phraseN = Math.max(1, opts.phraseBars ?? 4);

  // User “locked” template: assumes zero beats at session start (no seek offset).
  const totalNaive = elapsed * (bpm / 60);
  const measureNaive = Math.floor(totalNaive / 4) + 1;
  const barGroupNaive = Math.floor((measureNaive - 1) / phraseN) + 1;
  const beatNaive = (Math.floor(totalNaive) % 4) + 1;

  const tb = opts.totalBeatsUnwrapped;
  const measureTruth = Math.floor(tb / 4) + 1;
  const barGroupTruth = Math.floor((measureTruth - 1) / phraseN) + 1;
  const beatTruth = (Math.floor(tb) % 4) + 1;

  const phraseDaw =
    Math.floor((Math.max(1, opts.dawBar) - 1) / phraseN) + 1;

  console.table({
    'System Clock (s)': now.toFixed(3),
    'Elapsed Since Session Start': elapsed.toFixed(3),
    BPM: bpm,
    'Origin Beats (DAW)': opts.originBeats.toFixed(4),
    '[Naive] Total Beats (elapsed only)': totalNaive.toFixed(4),
    '[Naive] Bar floor(b/4)+1': measureNaive,
    '[Naive] Beat floor%4+1': beatNaive,
    [`[Naive] ${phraseN}-Bar Group`]: barGroupNaive,
    '[Truth] Total Beats (origin+elapsed)': tb.toFixed(4),
    '[Truth] Bar floor(b/4)+1': measureTruth,
    '[Truth] Beat floor%4+1': beatTruth,
    [`[Truth] ${phraseN}-Bar Group`]: barGroupTruth,
    'Display Beats (loop-wrapped)': opts.displayBeats.toFixed(4),
    'DAW bar (time-sig)': opts.dawBar,
    'DAW beat in bar': opts.dawBeatInBar,
    [`DAW phrase /${phraseN} bars`]: phraseDaw,
    'ctx.sampleRate (FYI)': opts.audioCtx.sampleRate,
  });
}

export const DEFAULT_BPM = 120;
export const DEFAULT_SR = 48000;
export const BUFFER_SIZE = 128;
export const SCHEDULER_AHEAD_SECS = 0.12;
/** Metronome lookahead polling — not click timing (clicks use scheduled `AudioContext` times). */
export const METRONOME_LOOKAHEAD_MS = 25;
export const MIDI_CLOCKS_PER_BEAT = 24;
const MIDI_CLOCK_TICK_INTERVAL = PPQ / MIDI_CLOCKS_PER_BEAT;
export const BEATS_PER_BAR = 4;
export const STEPS_PER_BAR = 4;
export const TICKS_PER_STEP = PPQ;

/** GM drum notes → internal drum channel ids (`triggerChannel`). */
const MIDI_DRUM_NOTE_TO_CHANNEL: Record<number, number> = {
  35: 17,
  36: 17,
  37: 2,
  38: 1,
  39: 2,
  40: 1,
  41: 7,
  42: 4,
  43: 7,
  44: 4,
  45: 6,
  46: 5,
  47: 6,
  48: 3,
  49: 3,
  50: 6,
  51: 3,
  52: 7,
  53: 3,
  55: 6,
  57: 6,
};

export type TransportState =
  | 'stopped'
  | 'playing'
  | 'paused'
  | 'recording'
  | 'counting';
export type QuantizeValue =
  | '1/1'
  | '1/2'
  | '1/4'
  | '1/8'
  | '1/16'
  | '1/32'
  | '1/8T'
  | '1/16T';
export const LOOP_BAR_OPTIONS = [1, 2, 4, 8, 12, 16, 32, 64] as const;
export type LoopModuleId =
  | 'creation-station'
  | 'piano-roll'
  | 'studio-editor'
  | 'master-arranger';

/** Per-module loop profile — single source of truth for transport + UI (TitleBar, grids). */
export type LoopProfile = {
  enabled: boolean;
  /** Loop length in bars (endBar - startBar + 1). */
  bars: number;
  startBar: number;
  /** Optional section label (e.g. "A") for arranger-style sections. */
  section: string | null;
};

/** All screens that share the top LOOP strip — loop geometry must not diverge across them. */
export const LOOP_MODULE_IDS: readonly LoopModuleId[] = [
  'creation-station',
  'piano-roll',
  'studio-editor',
  'master-arranger',
] as const;

function applyLoopPatchAll(
  prev: Record<LoopModuleId, LoopProfile>,
  patch: Partial<LoopProfile>,
): Record<LoopModuleId, LoopProfile> {
  const next = { ...prev };
  for (const id of LOOP_MODULE_IDS) {
    next[id] = { ...prev[id], ...patch };
  }
  return next;
}

/**
 * Derived snapshot: TitleBar, loop highlights, and transport must read the same fields.
 * Prefer `useMasterClock().loopState` over recomputing start/end/length separately.
 */
export type LoopState = {
  enabled: boolean;
  startBar: number;
  endBar: number;
  lengthBars: number;
  section: string | null;
};

export function loopStateFromParts(
  enabled: boolean,
  startBar: number,
  lengthBars: number,
  section: string | null,
): LoopState {
  const start = Math.max(1, startBar);
  const len = Math.max(1, lengthBars);
  return {
    enabled,
    startBar: start,
    endBar: start + len - 1,
    lengthBars: len,
    section,
  };
}

export interface TempoEvent {
  tick: number;
  bpm: number;
  curve?: number;
}

export interface TimeSigEvent {
  tick: number;
  numerator: number;
  denominator: 2 | 4 | 8 | 16;
}

/** Ticks per bar from time signature — same formula as `tickToBarBeat` in daw-types. */
export function ticksPerBarFromTimeSig(
  sig: Pick<TimeSigEvent, 'numerator' | 'denominator'>,
  ppq: number = PPQ,
): number {
  const ticksPerBeat = ppq * (4 / sig.denominator);
  return ticksPerBeat * sig.numerator;
}

export interface NoteEvent {
  id: string;
  pitch: number;
  start: number;
  length: number;
  velocity: number;
  releaseVelocity?: number;
  channel?: number;
  muted?: boolean;
  legato?: boolean;
}

export interface CCEvent {
  tick: number;
  value: number;
}

export interface AutomationLane {
  ccNumber: number;
  events: CCEvent[];
}

export interface TrackData {
  id: string;
  name: string;
  muted: boolean;
  solo: boolean;
  midiChannel: number;
  notes: NoteEvent[];
  automation: AutomationLane[];
}

export interface SessionExport {
  ppq: number;
  sampleRate: number;
  tempo: TempoEvent[];
  timeSigs: TimeSigEvent[];
  tracks: TrackData[];
  transport: {
    positionTicks: number;
    isPlaying: boolean;
    loop: {
      enabled: boolean;
      startTick: number;
      endTick: number;
    };
    punch: {
      enabled: boolean;
      inTick: number;
      outTick: number;
    };
    metronome: boolean;
  };
}

export function quantizeValueToTicks(q: QuantizeValue): number {
  return quantizeGridToTicks(q, PPQ);
}

export function snapTick(
  tick: number,
  gridTicks: number,
  strength = 1,
): number {
  const nearest = Math.round(tick / gridTicks) * gridTicks;
  return Math.round(tick + (nearest - tick) * strength);
}

export function ticksToSeconds(
  ticks: number,
  tempoMap: TempoEvent[],
): number {
  return dawTicksToSecs(ticks, tempoMap, PPQ);
}

export function secondsToTicks(
  seconds: number,
  tempoMap: TempoEvent[],
): number {
  return dawSecsToTicks(seconds, tempoMap, PPQ);
}

export function tickToBarBeat(
  tick: number,
  timeSigs: TimeSigEvent[],
  ppq = PPQ,
): { bar: number; beat: number; tickInBeat: number } {
  return dawTickToBarBeat(
    tick,
    timeSigs as Parameters<typeof dawTickToBarBeat>[1],
    ppq,
  );
}

/** Integer quarter indices published with the transport RAF — use with `useSyncExternalStore` so beat UI cannot miss a step when React batches context. */
/** Optional args for `record()` — pass from the UI so count-in matches PRE at click time (after `await arm()`, refs can lag a frame). */
export type RecordInvokeOptions = {
  countIn?: boolean;
  countInBeats?: number;
  /**
   * `AudioContext` time of the quarter boundary for the current playhead tick when recording starts.
   * Use after an external precount so the metronome continues in phase with those clicks (same as
   * the built-in count-in, which sets this from `t0 + countQuarters * spb`).
   * Must match the audio instant for `recordStartTick` / `tickCounterRef` — no extra offset (metronome locks to master sync clock).
   */
  metronomeBeat0AudioTime?: number;
  /**
   * Integer playhead tick used while scheduling external precount (must match {@link startTimer}’s
   * `initialTick`). If omitted, `tickCounterRef` is used — can diverge from Studio `snapTick(positionTicks)` by one grid step.
   */
  recordStartTick?: number;
};

export type TransportBeatUiSnapshot = {
  unwrappedQuarter: number;
  wrappedQuarter: number;
  /**
   * Loop-wrapped fractional quarter — same math as context `transportBeatFloat` at publish time.
   * Use for playhead X; keep `wrappedQuarter` for stepped grid/LEDs.
   */
  beatFloat: number;
  /**
   * Linear arranger quarters — metronome grid–locked, **not** loop-wrapped (`getStudioTimelineBeatFloatGridLockedAtAudioNow` at publish).
   * Matches Studio clips/ruler; use for in-clip playhead and record shade vs `beatFloat` (loop window).
   */
  studioTimelineBeatFloat: number;
  /**
   * Increments every master transport RAF while running — even when the two integers above are unchanged.
   * Lets `useSyncExternalStore` repaint Creation Station each frame (ties LEDs/columns to `transportBeatFloat`).
   */
  frameSeq: number;
};

export interface MasterClockContextValue {
  ppq: number;
  sampleRate: number;
  bpm: number;
  /**
   * Tempo used by transport + metronome math (`bpmRef`) — same value as `bpm` after layout, but safe to
   * call while scheduling audio (Studio precount, etc.) so quarter spacing matches the main MET exactly.
   */
  getTransportAudioBpm: () => number;
  /** Optional `{ fromLink: true }` when tempo comes from Ableton Link bridge (avoids feedback loop). */
  setBpm: (v: number, opts?: { fromLink?: boolean }) => void;
  transport: TransportState;
  tempoMap: TempoEvent[];
  timeSigs: TimeSigEvent[];
  setTempoMap: (m: TempoEvent[]) => void;
  setTimeSigs: (m: TimeSigEvent[]) => void;
  addTempoEvent: (ev: TempoEvent) => void;
  addTimeSigEvent: (ev: TimeSigEvent) => void;
  play: () => void;
  pause: () => void;
  stop: () => void;
  record: (opts?: RecordInvokeOptions) => void;
  /**
   * Schedule one metronome click at shared AudioContext time `t` (does not start transport).
   * For Studio count-in and similar; uses the same click timbre as the main metronome.
   */
  playMetronomeClickAt: (t: number, isDownbeat: boolean) => void;
  seekToTick: (tick: number) => void;
  positionTicks: number;
  /**
   * Fractional transport beat index (loop-wrapped when loop is on).
   * **Single source of truth** for playhead X, bar/beat UI, grid, clip position checks — derived only from AudioContext time.
   */
  transportBeatFloat: number;
  /**
   * Same as `transportBeatFloat`, updated every RAF (and on seek/pause/stop) for smooth UI / ref reads without React re-render.
   */
  transportBeatFloatRef: React.MutableRefObject<number>;
  /**
   * Loop-wrapped quarter index from float display beats — same as `transportBeatIndex`, updated every RAF / scheduler sync.
   */
  transportBeatIndexRef: React.MutableRefObject<number>;
  /** 1-based beat in bar — updated with transport refs every RAF / scheduler sync (optional for non-React consumers). */
  currentBeatInBarRef: React.MutableRefObject<number>;
  /**
   * Loop-wrapped quarter index: `floor(wrapGlobalBeatsToDisplayFloat(globalBeats))` from audio time — matches HUD / playhead strip (tick-round can jump a quarter early).
   */
  transportBeatIndex: number;
  /**
   * Global quarter index from **integer** transport ticks: `floor(positionTicks / ppq)` (MIDI / metronome step grid).
   */
  transportUnwrappedQuarterIndex: number;
  /** Same as {@link transportUnwrappedQuarterIndex}, updated every RAF / seek / pause — for non-React consumers. */
  transportUnwrappedQuarterIndexRef: React.MutableRefObject<number>;
  /**
   * Subscribe to `{ unwrappedQuarter, wrappedQuarter, beatFloat }` from the audio transport (master RAF or sync).
   * Prefer over context alone for step LEDs / pattern columns so commits cannot skip an integer boundary.
   */
  subscribeTransportBeatUi: (onStoreChange: () => void) => () => void;
  getTransportBeatUiSnapshot: () => TransportBeatUiSnapshot;
  currentStep: number;
  currentBar: number;
  currentTick: number;
  currentMeasure: number;
  currentBeat: number;
  currentSubstep: number;
  songBar: number;
  /** Same integer as transportBeatIndex (legacy name). */
  songStep: number;
  songBeat: number;
  /**
   * Increments on **seekToTick** (timeline jump). Consumers that anchor “since play” displays should
   * re-capture `getTickIntAtAudioNow` when this changes while transport ≠ stopped.
   */
  transportTimelineEpoch: number;
  totalBars: number;
  playheadFrac: number;
  songPlayheadFrac: number;
  loopEnabled: boolean;
  setLoopEnabled: (v: boolean) => void;
  loopBars: number;
  setLoopBars: (v: number) => void;
  /** Sets loop range, enables loop, updates length — use from TitleBar + pattern grids (one source of truth). */
  setLoopRange: (
    startBar: number,
    endBar: number,
    section?: string | null,
  ) => void;
  /**
   * Same bar math as setLoopRange but **does not** toggle LOOP on — use when previewing a section
   * or dragging arranger blocks; user still flips LOOP explicitly.
   */
  setLoopGeometry: (
    startBar: number,
    endBar: number,
    section?: string | null,
  ) => void;
  /** Disables looping; keeps start/length for when user turns LOOP back on. */
  clearLoop: () => void;
  /** Single derived object for highlights + top selector — always in sync with playback loop. */
  loopState: LoopState;
  /** Section label for the active module’s loop (e.g. "A"), if any. */
  loopSection: string | null;
  activeLoopModule: LoopModuleId;
  setActiveLoopModule: (m: LoopModuleId) => void;
  loopStartBar: number;
  setLoopStartBar: (v: number) => void;
  loopEndBar: number;
  loopStartTick: number;
  loopEndTick: number;
  /** Current bar length in ticks (from `timeSigs[0]`). */
  ticksPerBar: number;
  /** Quarter-note pulses per bar (= ticksPerBar / ppq); loop/scheduler step math must use this, not a fixed 4. */
  quartersPerBar: number;
  /** Beats per bar from time-sig numerator (1…N for MEASURE LEDs / tickToBarBeat). */
  beatsInBar: number;
  songTotalBars: number;
  setSongTotalBars: (v: number) => void;
  punchEnabled: boolean;
  setPunchEnabled: (v: boolean) => void;
  punchInTick: number;
  setPunchInTick: (v: number) => void;
  punchOutTick: number;
  setPunchOutTick: (v: number) => void;
  quantize: QuantizeValue;
  setQuantize: (v: QuantizeValue) => void;
  quantizeTicks: number;
  quantizeStrength: number;
  setQuantizeStrength: (v: number) => void;
  snapEnabled: boolean;
  setSnapEnabled: (v: boolean) => void;
  snapTick: (tick: number) => number;
  syncDrums: boolean;
  setSyncDrums: (v: boolean) => void;
  syncPiano: boolean;
  setSyncPiano: (v: boolean) => void;
  syncArr: boolean;
  setSyncArr: (v: boolean) => void;
  syncMix: boolean;
  setSyncMix: (v: boolean) => void;
  metronomeEnabled: boolean;
  setMetronomeEnabled: (v: boolean) => void;
  /**
   * Milliseconds added to **scheduled** metronome click times only (positive = later Play).
   * Transport / UI stay on the true audio clock; use for Bluetooth output latency.
   */
  metronomeClickLatencyMs: number;
  setMetronomeClickLatencyMs: (ms: number) => void;
  /** If `audioContext.outputLatency` is available, set click offset to roughly cancel it. */
  syncMetronomeClickLatencyFromOutput: () => void;
  countInEnabled: boolean;
  setCountInEnabled: (v: boolean) => void;
  /** Quarter-note clicks before Record when precount is on (default 4 = one 4/4 bar). */
  countInBeats: number;
  setCountInBeats: (v: number) => void;
  countDownTicks: number;
  midiClockEnabled: boolean;
  setMidiClockEnabled: (v: boolean) => void;
  sendMidiClock: () => void;
  patternMode: boolean;
  setPatternMode: (v: boolean) => void;
  channelLevels: Record<number, number>;
  channelVolumes: Record<number, number>;
  triggerChannel: (chId: number, velocity: number, when?: number) => void;
  setChannelVolume: (chId: number, volume: number) => void;
  ticksToSeconds: (ticks: number) => number;
  secondsToTicks: (secs: number) => number;
  tickToBarBeat: (tick: number) => {
    bar: number;
    beat: number;
    tickInBeat: number;
  };
  exportSession: (tracks?: TrackData[]) => SessionExport;
  /** Session master output 0–1 (all routes that use __daMusicMasterGain + internal metronome/count-in). */
  masterOutputLinear: number;
  setMasterOutputLinear: (v: number) => void;
  /** Integer MIDI tick at AudioContext time — **the** transport clock while running (sample-locked). */
  getTickIntAtAudioNow: (audioNow: number) => number;
  /**
   * Integer transport tick written on every master publish / RAF sync — same value as React `positionTicks`.
   * For Studio grid columns use `floor(wrapGlobalTickToDisplayTick(tickCounterRef.current) / ppq)` so the line
   * matches the tick/snapped grid; `transportBeatIndex` (`floor(displayBeats)`) can sit ±1 quarter at rare
   * float boundaries vs `round(globalBeats*ppq)`.
   */
  tickCounterRef: React.MutableRefObject<number>;
  /** Linear map global tick → audio time (inverse of transport anchor at play/BPM change). */
  mapGlobalTickToAudioTime: (globalTick: number) => number;
  /** Integer loop wrap — same as bar/beat UI / metronome accent phase. */
  wrapGlobalTickToDisplayTick: (globalTickInt: number) => number;
  /**
   * **Ironclad grid**: fractional, loop-wrapped quarter index at `audioNow` (seconds).
   * `originBeatFloat + max(0, audioNow - sessionStart) * bpm/60`, then loop wrap — pure clock math,
   * no beat events. Use with `requestAnimationFrame` + `useSyncExternalStore` so UI cannot skip when React batches.
   */
  getDisplayBeatsAtAudioNow: (audioNowSec: number) => number;
  /**
   * **Metronome / loop HUD**: fractional quarter, **loop-wrapped** when LOOP is on — same phase as
   * {@link getDisplayBeatsAtAudioNow} + {@link transportBeatFloatFromDisplayTick} (matches {@link transportBeatFloat}).
   */
  getTransportBeatFloatGridLockedAtAudioNow: (audioNowSec: number) => number;
  /**
   * **Linear arranger / Studio timeline**: same unwrapped phase as {@link getGlobalBeatsUnwrappedAtAudioNow}
   * (matches constant-BPM {@link mapGlobalTickToAudioTime} spacing — no extra piecewise interpolation).
   * When the metronome is on and click latency is set, uses `audioNow - latency` so the line tracks **heard** clicks.
   */
  getStudioTimelineBeatFloatGridLockedAtAudioNow: (audioNowSec: number) => number;
  /**
   * **Studio measure grid**: loop-wrapped quarter index at `audioNow` — `floor(getDisplayBeatsAtAudioNow)`;
   * same integer as RAF `transportBeat` / `transportBeatIndexRef`. Avoids piecewise beat maps that can advance
   * two quarters in one frame vs a linear clock.
   */
  getStudioGridQuarterIndexAtAudioNow: (audioNowSec: number) => number;
  /**
   * Unwrapped global quarter-note phase: `originBeatFloat + elapsed*bpm/60` — no loop wrap, no `round(tick)`.
   * Prefer over `floor(getTickIntAtAudioNow/ppq)` for Creation Station “four clicks per bar” when tick rounding
   * can advance the integer quarter index every other heard step.
   */
  getGlobalBeatsUnwrappedAtAudioNow: (audioNowSec: number) => number;
  /** Single shared graph: always use this instead of `new AudioContext()` from screens. */
  getOrCreateAudioContext: () => AudioContext;
  /** Post–master-gain analyser (for master output metering). Null until graph built. */
  masterMeterAnalyserRef: React.MutableRefObject<AnalyserNode | null>;
  audioCtxRef: React.MutableRefObject<AudioContext | null>;
  secondsPerStepRef: React.MutableRefObject<number>;
  loopStepsRef: React.MutableRefObject<number>;
  playStartTimeRef: React.MutableRefObject<number>;
}

const MasterClockContext = createContext<MasterClockContextValue | null>(null);

export function MasterClockProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { settings } = useSettings();
  const [bpmState, setBpmState] = useState(DEFAULT_BPM);
  const [transport, setTransport] = useState<TransportState>('stopped');
  const [tempoMap, setTempoMapState] = useState<TempoEvent[]>([
    { tick: 0, bpm: DEFAULT_BPM },
  ]);
  const [timeSigs, setTimeSigsState] = useState<TimeSigEvent[]>([
    { tick: 0, numerator: 4, denominator: 4 },
  ]);

  const [loopEnabled, setLoopEnabledState] = useState(false);
  const [loopBars, setLoopBarsState] = useState(16);
  const [loopStartBar, setLoopStartBarState] = useState(1);
  const [activeLoopModule, setActiveLoopModuleState] =
    useState<LoopModuleId>('creation-station');
  const [loopProfiles, setLoopProfiles] = useState<
    Record<LoopModuleId, LoopProfile>
  >(() => {
    const base: LoopProfile = {
      enabled: false,
      bars: 16,
      startBar: 1,
      section: null,
    };
    return {
      'creation-station': { ...base },
      'piano-roll': { ...base },
      'studio-editor': { ...base },
      'master-arranger': { ...base },
    };
  });
  const [songTotalBars, setSongTotalBars] = useState(128);

  const ticksPerBar = useMemo(
    () =>
      ticksPerBarFromTimeSig(
        timeSigs[0] ?? { tick: 0, numerator: 4, denominator: 4 },
        PPQ,
      ),
    [timeSigs],
  );
  const quartersPerBar = ticksPerBar / PPQ;
  const beatsInBar = useMemo(
    () => timeSigs[0]?.numerator ?? 4,
    [timeSigs],
  );

  const [punchEnabled, setPunchEnabled] = useState(false);
  const [punchInTick, setPunchInTick] = useState(0);
  const [punchOutTick, setPunchOutTick] = useState(PPQ * 16);

  const [quantize, setQuantize] = useState<QuantizeValue>('1/16');
  const [quantizeStrength, setQuantizeStrength] = useState(1.0);
  const [snapEnabled, setSnapEnabled] = useState(true);

  const [syncDrums, setSyncDrums] = useState(true);
  const [syncPiano, setSyncPiano] = useState(true);
  const [syncArr, setSyncArr] = useState(true);
  const [syncMix, setSyncMix] = useState(true);
  const [metronomeEnabled, setMetronomeEnabled] = useState(false);
  const [metronomeClickLatencyMs, setMetronomeClickLatencyMsState] =
    useState(0);
  const [countInEnabled, setCountInEnabled] = useState(true);
  const [countInBeats, setCountInBeats] = useState(4);
  const countInEnabledRef = useRef(true);
  const countInBeatsRef = useRef(4);
  countInEnabledRef.current = countInEnabled;
  countInBeatsRef.current = countInBeats;
  const [countDownTicks, setCountDownTicks] = useState(0);
  const [midiClockEnabled, setMidiClockEnabled] = useState(false);
  const midiClockEnabledRef = useRef(midiClockEnabled);
  useEffect(() => {
    midiClockEnabledRef.current = midiClockEnabled;
  }, [midiClockEnabled]);

  useEffect(() => {
    metronomeClickLatencyMsRef.current = metronomeClickLatencyMs;
  }, [metronomeClickLatencyMs]);

  const setMetronomeClickLatencyMs = useCallback((v: number) => {
    const n = Math.round(Number(v));
    if (!Number.isFinite(n)) return;
    setMetronomeClickLatencyMsState(Math.max(-500, Math.min(500, n)));
  }, []);

  const [patternMode, setPatternMode] = useState(true);
  const [channelLevels, setChannelLevels] = useState<Record<number, number>>(
    {},
  );
  const [channelVolumes, setChannelVolumesState] = useState<
    Record<number, number>
  >({});

  const loopStartTick = (loopStartBar - 1) * ticksPerBar;
  const loopEndTick = loopStartTick + loopBars * ticksPerBar;
  const loopEndBar = loopStartBar + loopBars - 1;
  const totalBars = songTotalBars;

  // ── Refs ────────────────────────────────────────────────────────────────
  const bpmRef = useRef(DEFAULT_BPM);
  const tempoMapRef = useRef<TempoEvent[]>([
    { tick: 0, bpm: DEFAULT_BPM },
  ]);
  const timeSigsRef = useRef<TimeSigEvent[]>([
    { tick: 0, numerator: 4, denominator: 4 },
  ]);
  const ticksPerBarRef = useRef(PPQ * 4);
  const loopBarsRef = useRef(16);
  const loopStartBarRef = useRef(1);
  const loopEnabledRef = useRef(false);
  const songTotalBarsRef = useRef(128);
  const metronomeRef = useRef(false);
  const metronomeClickLatencyMsRef = useRef(0);
  const channelVolsRef = useRef<Record<number, number>>({});
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleAheadTime = SCHEDULER_AHEAD_SECS;
  /** Shorter interval = more resilient when the tab/main thread is throttled. */
  const schedulerIntervalMs = 8;
  const rafRef = useRef<number | null>(null);
  const rafRunIdRef = useRef(0);
  const tickCounterRef = useRef(0);
  /** Single transport position (beats, fractional) — updated every RAF; use for playhead/ref reads. */
  const transportBeatFloatRef = useRef(0);
  const transportBeatIndexRef = useRef(0);
  const transportUnwrappedQuarterIndexRef = useRef(0);
  const beatUiFrameSeqRef = useRef(0);
  const beatUiSnapshotRef = useRef<TransportBeatUiSnapshot>({
    unwrappedQuarter: 0,
    wrappedQuarter: 0,
    beatFloat: 0,
    studioTimelineBeatFloat: 0,
    frameSeq: 0,
  });
  const beatUiListenersRef = useRef(new Set<() => void>());
  const publishTransportBeatUiRef = useRef<
    (
      u: number,
      s: number,
      beatFloat: number,
      studioTimelineBeatFloat: number,
    ) => void
  >(() => {});
  publishTransportBeatUiRef.current = (
    u: number,
    s: number,
    beatFloat: number,
    studioTimelineBeatFloat: number,
  ) => {
    // Always publish audio-derived beats. A former ±1 throttle let the metronome (audio clock)
    // run ahead of this store when RAF lagged — metronome heard before the playhead moved.
    transportUnwrappedQuarterIndexRef.current = u;
    transportBeatIndexRef.current = s;
    beatUiFrameSeqRef.current += 1;
    beatUiSnapshotRef.current = {
      unwrappedQuarter: u,
      wrappedQuarter: s,
      beatFloat,
      studioTimelineBeatFloat,
      frameSeq: beatUiFrameSeqRef.current,
    };
    beatUiListenersRef.current.forEach((fn) => {
      try {
        fn();
      } catch {
        /* ignore subscriber errors */
      }
    });
  };
  const currentBeatInBarRef = useRef(1);
  /** Latest `syncTransportDisplayRefsFromAudio` — scheduler calls this so closures never go stale. */
  const syncTransportDisplayFromAudioFnRef = useRef<() => void>(() => {});
  /** Last audio-time (ms) touched on RAF publish — bookkeeping for resume/seek paths. */
  const lastUiPublishMsRef = useRef(0);
  /** Last published loop-wrapped transport quarter index (songStep) — seek/stop reset. */
  const lastPublishedTransportBeatIntRef = useRef<number | null>(null);
  const transportRef = useRef<TransportState>('stopped');
  /** True only while `record()` is inside the audio wait for precount — do not tie this to `transportRef` (layout sync can race). */
  const countInPhaseRef = useRef(false);
  const isRunningRef = useRef(false);
  /** Integer tick anchor — kept equal to `round(originBeatFloatRef * PPQ)` when snapping (seek/pause/BPM). */
  const originTickRef = useRef(0);
  /**
   * Absolute timeline phase in **quarter-note beats** at `startAudioTimeRef` (unwrapped song position).
   * Running position is always: `originBeatFloatRef + (audioCtx.currentTime - startAudioTimeRef) * bpm / 60`
   * — no incremental measure++, hardware-locked.
   */
  const originBeatFloatRef = useRef(0);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sampleRate = audioCtxRef.current?.sampleRate ?? DEFAULT_SR;
  const masterGainRef = useRef<GainNode | null>(null);
  const masterMeterAnalyserRef = useRef<AnalyserNode | null>(null);
  /** 0–1 linear gain into speakers (single master bus). */
  const masterOutputLinearRef = useRef(0.8);
  const [masterOutputLinear, setMasterOutputLinearState] = useState(0.8);
  const secondsPerStepRef = useRef(60 / DEFAULT_BPM / 4);
  const loopStepsRef = useRef(STEPS_PER_BAR);
  // Sentinel -1 means "not started". 0 is a valid AudioContext start time.
  const playStartTimeRef = useRef(-1);
  const midiOutputRef = useRef<MIDIOutput | null>(null);
  const midiAccessRef = useRef<MIDIAccess | null>(null);
  /** Pitched notes from MIDI input: key "ch:note" → release/stop function */
  const midiInputVoicesRef = useRef(new Map<string, () => void>());
  /** Legacy: terminate if present (older builds used a pulse worker for metronome). */
  const metronomePulseWorkerRef = useRef<Worker | null>(null);
  /** When true, transport rAF refills metronome lookahead (`startMetronomeLoop` / `stopMetronomeLoop`). */
  const metronomeActiveRef = useRef(false);
  const runMetronomeSchedulerRef = useRef<() => void>(() => {});
  const metronomeNextBeatTimeRef = useRef(0);
  /** Next metronome click — global quarter tick (integer). */
  const metronomeNextQuarterTickRef = useRef(0);
  const metronomeBeatIndexRef = useRef(0);
  const playMetronomeClickAtRef = useRef<(t: number, isDownbeat: boolean) => void>(
    () => {},
  );
  const lastMetronomeBeatRef = useRef(-1);
  /** Bumped on metronome stop — stale `TransportPulseWorker` callbacks no-op (same pattern as MIDI clock). */
  const metronomeSchedulerRunIdRef = useRef(0);
  const midiClockPulseWorkerRef = useRef<Worker | null>(null);
  const runMidiClockSchedulerRef = useRef<(runId: number) => void>(() => {});
  const midiClockSchedulerRunIdRef = useRef(0);
  const midiClockNextGlobalTickRef = useRef(0);
  const sendMidiRealtimeRef = useRef<(status: number, audioTime?: number) => void>(
    () => {},
  );
  const sampleRateRef = useRef(DEFAULT_SR);
  const startAudioTimeRef = useRef(0);

  // ── Ref sync effects ────────────────────────────────────────────────────
  /** Layout: keep `bpmRef` aligned before paint so count-in / MET use the same BPM as `mapGlobalTickToAudioTime`. */
  useLayoutEffect(() => {
    bpmRef.current = bpmState;
    secondsPerStepRef.current = 60 / bpmState / 4;
  }, [bpmState]);
  useEffect(() => {
    tempoMapRef.current = tempoMap;
  }, [tempoMap]);
  useEffect(() => {
    timeSigsRef.current = timeSigs;
    ticksPerBarRef.current = ticksPerBar;
  }, [timeSigs, ticksPerBar]);
  useEffect(() => {
    loopBarsRef.current = loopBars;
    loopStepsRef.current = loopBars * STEPS_PER_BAR;
  }, [loopBars]);
  useEffect(() => {
    loopStartBarRef.current = loopStartBar;
  }, [loopStartBar]);
  useEffect(() => {
    loopEnabledRef.current = loopEnabled;
  }, [loopEnabled]);
  useEffect(() => {
    songTotalBarsRef.current = songTotalBars;
  }, [songTotalBars]);
  useLayoutEffect(() => {
    metronomeRef.current = metronomeEnabled;
  }, [metronomeEnabled]);
  useEffect(() => {
    channelVolsRef.current = channelVolumes;
  }, [channelVolumes]);
  useLayoutEffect(() => {
    transportRef.current = transport;
  }, [transport]);

  useEffect(() => {
    masterOutputLinearRef.current = masterOutputLinear;
    const g = masterGainRef.current;
    if (g && g.context.state !== 'closed') {
      g.gain.value = Math.max(0, Math.min(1, masterOutputLinear));
    }
  }, [masterOutputLinear]);

  const setMasterOutputLinear = useCallback((v: number) => {
    setMasterOutputLinearState(Math.max(0, Math.min(1, v)));
  }, []);

  /** Replace closed/suspended-stale refs — a closed AudioContext is truthy but unusable (silent engine). */
  const getOrCreateAudioContext = useCallback((): AudioContext => {
    let ctx = audioCtxRef.current;
    if (!ctx || ctx.state === 'closed') {
      ctx = new (window.AudioContext ||
        (window as any).webkitAudioContext)();
      audioCtxRef.current = ctx;
      masterGainRef.current = null;
      masterMeterAnalyserRef.current = null;
      // Avoid connecting nodes from the new ctx to a GainNode from a closed/old context.
      (window as unknown as { __daMusicMasterGain?: GainNode | null }).__daMusicMasterGain =
        undefined;
      (window as unknown as { __daMusicMasterAnalyser?: AnalyserNode | null }).__daMusicMasterAnalyser =
        undefined;
    }
    if (
      !masterGainRef.current ||
      masterGainRef.current.context !== ctx
    ) {
      const master = ctx.createGain();
      master.gain.value = Math.max(0, Math.min(1, masterOutputLinearRef.current));
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.65;
      master.connect(analyser);
      analyser.connect(ctx.destination);
      masterGainRef.current = master;
      masterMeterAnalyserRef.current = analyser;
      (window as unknown as { __daMusicMasterGain?: GainNode }).__daMusicMasterGain =
        master;
      (window as unknown as { __daMusicMasterAnalyser?: AnalyserNode }).__daMusicMasterAnalyser =
        analyser;
    }
    return ctx;
  }, []);

  const syncMetronomeClickLatencyFromOutput = useCallback(() => {
    const ctx = audioCtxRef.current ?? getOrCreateAudioContext();
    if (ctx.state === 'closed') return;
    const lat = ctx.outputLatency;
    if (typeof lat === 'number' && Number.isFinite(lat) && lat > 0) {
      setMetronomeClickLatencyMsState(
        Math.max(-500, Math.min(500, Math.round(-lat * 1000))),
      );
    }
  }, [getOrCreateAudioContext]);

  // ── Visibility handler — prevents drift when tab loses/regains focus ──────
  // When the browser suspends the AudioContext (e.g. tab switch), ctx.currentTime
  // pauses while the app is hidden. On return we resume the context
  // AND resync all timing refs so the bar counter and metronome stay locked.
  useEffect(() => {
    const handleVisibility = () => {
      const ctx = audioCtxRef.current;
      if (!ctx) return;

      if (document.visibilityState === 'visible') {
        // Only resume if suspended (not if closed)
        if (ctx.state === 'suspended') {
          ctx
            .resume()
            .then(() => {
              if (!isRunningRef.current) return;

              const nowT = ctx.currentTime;
              const bpmVis = Math.max(1, bpmRef.current);
              const elapsedVis = Math.max(0, nowT - startAudioTimeRef.current);
              const beatsLive =
                originBeatFloatRef.current + (elapsedVis * bpmVis) / 60;
              const tickLive = Math.max(0, Math.round(beatsLive * PPQ));
              tickCounterRef.current = tickLive;
              originBeatFloatRef.current = beatsLive;
              originTickRef.current = tickLive;
              startAudioTimeRef.current = nowT;
              playStartTimeRef.current = nowT;

              const displayBeats = wrapGlobalBeatsToDisplayFloat(beatsLive);
              const dVis = displayBeats * PPQ;
              transportBeatFloatRef.current =
                transportBeatFloatFromDisplayTick(dVis);
              transportBeatIndexRef.current = Math.floor(displayBeats);
              currentBeatInBarRef.current = dawTickToBarBeatFromFloat(
                dVis,
                timeSigsRef.current,
                PPQ,
              ).beat;

              // Restart metronome lookahead phase-locked to transport (AudioContext clock)
              if (metronomeRef.current) {
                stopMetronomeLoop();
                startMetronomeLoop(bpmRef.current);
              }

              console.debug(
                '[MasterClock] Tab visible — AudioContext resumed & clock resynced',
              );
            })
            .catch((err) => {
              console.warn('[MasterClock] Resume failed:', err);
            });
        } else if (ctx.state === 'closed') {
          console.warn('[MasterClock] AudioContext closed, cannot resume');
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () =>
      document.removeEventListener('visibilitychange', handleVisibility);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Channel level decay
  useEffect(() => {
    const CHANNEL_DECAY_MULT = 0.35;
    const CHANNEL_DECAY_MS = 10;
    const CHANNEL_ZERO_SNAP = 0.03;
    const id = setInterval(() => {
      setChannelLevels((prev) => {
        const next: Record<number, number> = {};
        let changed = false;
        for (const k in prev) {
          const dRaw = Math.max(0, prev[k] * CHANNEL_DECAY_MULT);
          const d = dRaw < CHANNEL_ZERO_SNAP ? 0 : dRaw;
          next[k] = d;
          if (d !== prev[k]) changed = true;
        }
        return changed ? next : prev;
      });
    }, CHANNEL_DECAY_MS);
    return () => clearInterval(id);
  }, []);

  // ── Metronome (AudioContext clock — not tied to recording buffer loop) ─
  /** Schedule one click at audio time `t` into the master bus (lookahead path). */
  const playMetronomeClickAt = useCallback(
    (t: number, isDownbeat: boolean) => {
      try {
        const ctx = getOrCreateAudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        const master = masterGainRef.current;
        const dest =
          master && master.context === ctx ? master : ctx.destination;
        gain.connect(dest);
        osc.frequency.value = isDownbeat ? 1000 : 800;
        osc.type = 'sine';
        const clickDuration = 0.12;
        // Click-only latency (Bluetooth, etc.): UI/transport stay on the true grid clock.
        const tAdj = t + metronomeClickLatencyMsRef.current / 1000;
        // Past times break scheduling when the main thread stalls; clamp to now (tiny shift, avoids dropped clicks).
        const tSafe = Math.max(tAdj, ctx.currentTime + 0.0005);
        // Soft attack + decay — no DynamicsCompressor (avoids LF pumping / noise floor).
        gain.gain.setValueAtTime(0.0001, tSafe);
        gain.gain.exponentialRampToValueAtTime(0.38, tSafe + 0.004);
        gain.gain.linearRampToValueAtTime(0.32, tSafe + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, tSafe + clickDuration);
        osc.start(tSafe);
        osc.stop(tSafe + clickDuration);
        osc.onended = () => {
          try {
            osc.disconnect();
            gain.disconnect();
          } catch {
            /* already disconnected */
          }
        };
      } catch (e) {
        console.debug('Metronome error (non-critical):', e);
      }
    },
    [getOrCreateAudioContext],
  );

  playMetronomeClickAtRef.current = playMetronomeClickAt;

  const playMetronomeClick = useCallback(
    (isDownbeat: boolean) => {
      if (!metronomeRef.current) return;
      const ctx = getOrCreateAudioContext();
      playMetronomeClickAt(ctx.currentTime, isDownbeat);
    },
    [getOrCreateAudioContext, playMetronomeClickAt],
  );

  /** Single loop-remap helper — declared before metronome align + lookahead (must exist before use). */
  const remapBeatToTransport = useCallback((beatGlobalFloat: number) => {
    if (!loopEnabledRef.current) return beatGlobalFloat;
    const qpb = ticksPerBarRef.current / PPQ;
    const loopStartBeat = (loopStartBarRef.current - 1) * qpb;
    const loopBeatsN = Math.max(1, loopBarsRef.current * qpb);
    const rel = beatGlobalFloat - loopStartBeat;
    const wrapped = ((rel % loopBeatsN) + loopBeatsN) % loopBeatsN;
    return loopStartBeat + wrapped;
  }, []);

  /**
   * MASTER TIMEBASE: integer MIDI ticks from hardware clock — **never** increment with measure++.
   * `round((originBeat + elapsed*bpm/60) * PPQ)` — exact inverse of {@link mapGlobalTickToAudioTime}.
   */
  const getTickIntAtAudioNow = useCallback((audioNow: number): number => {
    const bpm = Math.max(1, bpmRef.current);
    const elapsedSec = Math.max(0, audioNow - startAudioTimeRef.current);
    const globalBeats = originBeatFloatRef.current + (elapsedSec * bpm) / 60;
    return Math.max(0, Math.round(globalBeats * PPQ));
  }, []);

  /**
   * Global tick → loop-wrapped **display** tick (same as bar/beat counter + grid). Metronome accents
   * use this so click 1 lines up with the UI beat "1", not float `remapBeatToTransport` jitter.
   */
  const wrapGlobalTickToDisplayTick = useCallback((tickInt: number): number => {
    if (!loopEnabledRef.current) return tickInt;
    const tb = ticksPerBarRef.current;
    const loopStartTick = (loopStartBarRef.current - 1) * tb;
    const loopLenTicks = Math.max(1, loopBarsRef.current * tb);
    const rel = tickInt - loopStartTick;
    return loopStartTick + ((rel % loopLenTicks) + loopLenTicks) % loopLenTicks;
  }, []);

  /**
   * Loop wrap in **quarter-beat** space — same window as tick wrap (`loopLen * PPQ` ticks).
   * Display phase = `(originBeat + elapsed * bpm/60)` then this wrap when LOOP is on.
   */
  const wrapGlobalBeatsToDisplayFloat = useCallback((globalBeats: number): number => {
    if (!loopEnabledRef.current) return globalBeats;
    const qpb = ticksPerBarRef.current / PPQ;
    const loopStartBeats = (loopStartBarRef.current - 1) * qpb;
    const loopLenBeats = Math.max(1, loopBarsRef.current * qpb);
    const rel = globalBeats - loopStartBeats;
    return loopStartBeats + ((rel % loopLenBeats) + loopLenBeats) % loopLenBeats;
  }, []);

  /** Fractional tick in loop window — derivable from {@link wrapGlobalBeatsToDisplayFloat}(tick/PPQ)*PPQ. */
  const wrapGlobalTickToDisplayTickFloat = useCallback(
    (tickFloat: number): number =>
      wrapGlobalBeatsToDisplayFloat(tickFloat / PPQ) * PPQ,
    [wrapGlobalBeatsToDisplayFloat],
  );

  /** Exact linear inverse of {@link getTickIntAtAudioNow} — `AudioContext` clock, no tick accumulation. */
  const mapGlobalTickToAudioTime = useCallback((globalTick: number): number => {
    const bpm = Math.max(1, bpmRef.current);
    const targetBeats = globalTick / PPQ;
    const deltaBeats = targetBeats - originBeatFloatRef.current;
    return startAudioTimeRef.current + (deltaBeats * 60) / bpm;
  }, []);

  /** Loop-wrapped fractional quarter index — same as MasterClock RAF `displayBeats`; pure `audioCtx.currentTime` grid. */
  const getDisplayBeatsAtAudioNow = useCallback((audioNow: number): number => {
    const bpm = Math.max(1, bpmRef.current);
    const elapsed = Math.max(0, audioNow - startAudioTimeRef.current);
    const globalBeats = originBeatFloatRef.current + (elapsed * bpm) / 60;
    return wrapGlobalBeatsToDisplayFloat(globalBeats);
  }, [wrapGlobalBeatsToDisplayFloat]);

  /**
   * Transport playhead phase: same linear clock + loop wrap as {@link getDisplayBeatsAtAudioNow}, then
   * {@link transportBeatFloatFromDisplayTick} for stable fractional beats at large tick positions.
   */
  const getTransportBeatFloatGridLockedAtAudioNow = useCallback(
    (audioNow: number): number => {
      const displayBeats = getDisplayBeatsAtAudioNow(audioNow);
      return transportBeatFloatFromDisplayTick(displayBeats * PPQ);
    },
    [getDisplayBeatsAtAudioNow],
  );

  /** Unwrapped quarter-note float — same `globalBeats` as tick math before `round(globalBeats*PPQ)`. */
  const getGlobalBeatsUnwrappedAtAudioNow = useCallback((audioNow: number): number => {
    const bpm = Math.max(1, bpmRef.current);
    const elapsed = Math.max(0, audioNow - startAudioTimeRef.current);
    return originBeatFloatRef.current + (elapsed * bpm) / 60;
  }, []);

  /**
   * Linear arranger phase — **exact** `originBeat + Δt·bpm/60` (same slope as {@link mapGlobalTickToAudioTime} at constant BPM).
   * Avoids a second piecewise interpolation path that can micro-jitter vs the metronome grid.
   * When the metronome is on and click latency is non-zero, uses `audioNow - latency` so the line matches **heard** clicks.
   */
  const getStudioTimelineBeatFloatGridLockedAtAudioNow = useCallback(
    (audioNow: number): number => {
      let t = audioNow;
      if (metronomeRef.current && metronomeClickLatencyMsRef.current !== 0) {
        t = audioNow - metronomeClickLatencyMsRef.current / 1000;
      }
      return getGlobalBeatsUnwrappedAtAudioNow(t);
    },
    [getGlobalBeatsUnwrappedAtAudioNow],
  );

  /** Same integer quarter as transport RAF `transportBeat` — linear display phase (every quarter advances +1). */
  const getStudioGridQuarterIndexAtAudioNow = useCallback(
    (audioNow: number): number =>
      Math.floor(getDisplayBeatsAtAudioNow(audioNow) + 1e-9),
    [getDisplayBeatsAtAudioNow],
  );

  /** Global quarter-note phase (beats); equals `getTickIntAtAudioNow / PPQ` for all consumers. */
  const getBeatGlobalFromAudioNow = useCallback(
    (audioNow: number) => getTickIntAtAudioNow(audioNow) / PPQ,
    [getTickIntAtAudioNow],
  );
  const getBeatGlobalFromAudioNowRef = useRef(getBeatGlobalFromAudioNow);
  getBeatGlobalFromAudioNowRef.current = getBeatGlobalFromAudioNow;
  const sendMidiRealtime = useCallback((status: number, audioTime?: number) => {
    const out = midiOutputRef.current;
    if (!out) return;
    try {
      if (audioTime === undefined) {
        out.send([status]);
        return;
      }
      const ctx = audioCtxRef.current;
      if (!ctx || ctx.state === 'closed') {
        out.send([status]);
        return;
      }
      const perfWhen = performance.now() + (audioTime - ctx.currentTime) * 1000;
      out.send([status], Math.max(performance.now(), perfWhen));
    } catch (e) {
      console.debug('MIDI realtime send error:', e);
    }
  }, []);
  sendMidiRealtimeRef.current = sendMidiRealtime;
  const sendMidiClock = useCallback(() => {
    if (!midiClockEnabledRef.current) return;
    sendMidiRealtimeRef.current(0xf8);
  }, []);

  const sendMidiSongPositionPointer = useCallback((tick: number) => {
    const out = midiOutputRef.current;
    if (!out) return;
    try {
      // MIDI SPP units are 16th notes (6 MIDI clocks each).
      const sixteenth = Math.max(0, Math.floor(tick / (PPQ / 4)));
      out.send([0xf2, sixteenth & 0x7f, (sixteenth >> 7) & 0x7f]);
    } catch (e) {
      console.debug('MIDI SPP send error:', e);
    }
  }, []);

  /**
   * Push transport phase refs using the same monotonic tick rule as the RAF loop.
   * Called from lookahead schedulers when `requestAnimationFrame` is delayed.
   */
  const syncTransportDisplayRefsFromAudio = useCallback(() => {
    if (!isRunningRef.current) return;
    const ctx = audioCtxRef.current;
    if (!ctx || ctx.state === 'closed') return;
    const audioNow = ctx.currentTime;
    const bpm = Math.max(1, bpmRef.current);
    const elapsed = Math.max(0, audioNow - startAudioTimeRef.current);
    const globalBeats = originBeatFloatRef.current + (elapsed * bpm) / 60;
    const tickInt = Math.max(0, Math.round(globalBeats * PPQ));
    tickCounterRef.current = tickInt;
    const displayBeats = getDisplayBeatsAtAudioNow(audioNow);
    const displayTickFloat = displayBeats * PPQ;
    /** Audio-time quarter index — must match `floor(displayBeats)`, not `floor(wrapTick(round(beats*PPQ)))` (those diverge at beat boundaries and “skip”). */
    const transportBeat = Math.floor(displayBeats + 1e-9);
    const unwrappedQuarterGridLocked = Math.floor(globalBeats + 1e-9);
    const beatFloatSync =
      transportBeatFloatFromDisplayTick(displayTickFloat);
    transportBeatFloatRef.current = beatFloatSync;
    transportBeatIndexRef.current = transportBeat;
    currentBeatInBarRef.current = dawTickToBarBeatFromFloat(
      displayTickFloat,
      timeSigsRef.current,
      PPQ,
    ).beat;
    const studioTimelineBeatFloat =
      getStudioTimelineBeatFloatGridLockedAtAudioNow(audioNow);
    publishTransportBeatUiRef.current(
      unwrappedQuarterGridLocked,
      transportBeat,
      beatFloatSync,
      studioTimelineBeatFloat,
    );
  }, [getDisplayBeatsAtAudioNow, getStudioTimelineBeatFloatGridLockedAtAudioNow]);
  syncTransportDisplayFromAudioFnRef.current = syncTransportDisplayRefsFromAudio;

  // ── Metronome lookahead (decoupled from MIDI scheduler & buffer loop) ───
  const runMetronomeScheduler = useCallback(() => {
    try {
      const ctx = audioCtxRef.current;
      if (
        !ctx ||
        ctx.state === 'closed' ||
        !isRunningRef.current ||
        !metronomeRef.current ||
        !metronomeActiveRef.current
      ) {
        return;
      }
      if (ctx.state === 'suspended') {
        void ctx.resume().catch(() => {});
      }
      const now = ctx.currentTime;
      const bpmSched = Math.max(1, bpmRef.current);
      const spbSched = 60 / bpmSched;
      /* Deep enough buffer for choppy rAF (low-power tab, one bad frame) — thin lookahead runs dry → missing clicks. */
      const scheduleUntil = now + Math.max(1.25, spbSched * 4.5);
      /**
       * Past grid times: **do not** stack many clicks at `now` with stagger — that sounds like a burst and
       * reads as “metronome not locked” vs the linear playhead. Skip beats that are too far behind (silent
       * phase advance), clamp slightly-late to `now`, and allow **at most one** late audible click per
       * scheduler pass so catch-up stays aligned with the transport clock.
       */
      const lateDropSec = Math.min(0.1, Math.max(0.04, spbSched * 0.25));
      let nextTick = metronomeNextQuarterTickRef.current;
      let iter = 0;
      let usedLateCatchUpThisRun = false;
      while (iter++ < 512) {
        const tGrid = mapGlobalTickToAudioTime(nextTick);
        if (tGrid >= scheduleUntil) break;

        if (tGrid < now - lateDropSec) {
          nextTick += PPQ;
          continue;
        }

        let tPlay = tGrid;
        if (tGrid < now) {
          if (usedLateCatchUpThisRun) {
            nextTick += PPQ;
            continue;
          }
          usedLateCatchUpThisRun = true;
          tPlay = Math.max(now + 0.0005, tGrid);
        }

        const displayTick = wrapGlobalTickToDisplayTick(nextTick);
        const { beat: beat1 } = dawTickToBarBeat(
          displayTick,
          timeSigsRef.current,
          PPQ,
        );
        const isDown = beat1 === 1;
        playMetronomeClickAtRef.current(tPlay, isDown);
        nextTick += PPQ;
      }
      metronomeNextQuarterTickRef.current = nextTick;
      metronomeBeatIndexRef.current = Math.floor(nextTick / PPQ);
      metronomeNextBeatTimeRef.current = mapGlobalTickToAudioTime(nextTick);
    } catch (e) {
      console.debug('Metronome scheduler error (non-critical):', e);
    }
  }, [mapGlobalTickToAudioTime, wrapGlobalTickToDisplayTick]);

  const runMidiClockScheduler = useCallback((runId: number) => {
    if (runId !== midiClockSchedulerRunIdRef.current) return;
    const ctx = audioCtxRef.current;
    if (!ctx || !isRunningRef.current || !midiClockEnabledRef.current || !midiOutputRef.current) {
      return;
    }
    const now = ctx.currentTime;
    const scheduleUntil = now + 0.18;
    let nextTick = midiClockNextGlobalTickRef.current;
    let iter = 0;
    while (iter++ < 2048) {
      const t = mapGlobalTickToAudioTime(nextTick);
      if (t >= scheduleUntil) break;
      if (t >= now - 0.01) {
        sendMidiRealtimeRef.current(0xf8, t);
      }
      nextTick += MIDI_CLOCK_TICK_INTERVAL;
    }
    midiClockNextGlobalTickRef.current = nextTick;
  }, [mapGlobalTickToAudioTime]);

  const startMetronomeLoop = useCallback(
    (
      _bpm: number,
      align?: { metronomeAnchorTick?: number },
    ) => {
      if (!metronomeRef.current) return;
      /* Second start without an anchor: no-op only if worker is alive. Otherwise we must rebuild — e.g.
       * start threw after setting `active`, or the worker died, which used to strand MET with no pulses. */
      if (
        metronomeActiveRef.current &&
        align == null &&
        metronomePulseWorkerRef.current != null
      ) {
        return;
      }
      try {
        const ctx = getOrCreateAudioContext();
        if (metronomePulseWorkerRef.current) {
          metronomeSchedulerRunIdRef.current += 1;
          try {
            metronomePulseWorkerRef.current.postMessage({ cmd: 'stop' });
            metronomePulseWorkerRef.current.terminate();
          } catch {
            /* ignore */
          }
          metronomePulseWorkerRef.current = null;
        }
        metronomeActiveRef.current = true;
        const now = ctx.currentTime;
        const anchor = align?.metronomeAnchorTick;
        if (typeof anchor === 'number' && Number.isFinite(anchor)) {
          /* Same global tick as `startTimer` + `metronomeBeat0AudioTime` — keeps lookahead on precount grid. */
          /*
           * Fire the downbeat once here: first lookahead pass may see `anchor` in the past; `playMetronomeClickAt`
           * clamps to a safe start time.
           */
          const tClick = mapGlobalTickToAudioTime(anchor);
          const displayTickA = wrapGlobalTickToDisplayTick(Math.max(0, anchor));
          const { beat: beat1a } = dawTickToBarBeat(
            displayTickA,
            timeSigsRef.current,
            PPQ,
          );
          playMetronomeClickAtRef.current(tClick, beat1a === 1);
          metronomeNextQuarterTickRef.current = anchor + PPQ;
        } else {
          const tickNow = getTickIntAtAudioNow(now);
          /** Next quarter boundary whose scheduled time is not in the past. */
          let nextTick = Math.ceil(tickNow / PPQ) * PPQ;
          for (let i = 0; i < 64; i++) {
            if (mapGlobalTickToAudioTime(nextTick) >= now - 0.1) break;
            nextTick += PPQ;
          }
          metronomeNextQuarterTickRef.current = nextTick;
        }
        metronomeNextBeatTimeRef.current = mapGlobalTickToAudioTime(
          metronomeNextQuarterTickRef.current,
        );
        metronomeBeatIndexRef.current = Math.floor(
          metronomeNextQuarterTickRef.current / PPQ,
        );
        runMetronomeSchedulerRef.current = runMetronomeScheduler;
        runMetronomeScheduler();
        const metroRunId = metronomeSchedulerRunIdRef.current + 1;
        metronomeSchedulerRunIdRef.current = metroRunId;
        const MetroWorkerCtor = TransportPulseWorker as unknown as { new (): Worker };
        const mw = new MetroWorkerCtor();
        mw.onmessage = () => {
          if (metroRunId !== metronomeSchedulerRunIdRef.current) return;
          if (
            !isRunningRef.current ||
            !metronomeActiveRef.current ||
            !metronomeRef.current
          ) {
            return;
          }
          runMetronomeSchedulerRef.current();
        };
        mw.postMessage({
          cmd: 'start',
          intervalMs: 12,
        });
        metronomePulseWorkerRef.current = mw;
      } catch (e) {
        console.debug('Metronome lookahead start error:', e);
        metronomeSchedulerRunIdRef.current += 1;
        metronomeActiveRef.current = false;
        metronomePulseWorkerRef.current = null;
      }
    },
    [
      getOrCreateAudioContext,
      getTickIntAtAudioNow,
      mapGlobalTickToAudioTime,
      runMetronomeScheduler,
      wrapGlobalTickToDisplayTick,
    ],
  );

  const startMidiClockLoop = useCallback(() => {
    if (!midiClockEnabledRef.current || !midiOutputRef.current) return;
    try {
      const ctx = getOrCreateAudioContext();
      if (midiClockPulseWorkerRef.current) {
        midiClockPulseWorkerRef.current.postMessage({ cmd: 'stop' });
        midiClockPulseWorkerRef.current.terminate();
        midiClockPulseWorkerRef.current = null;
      }
      const runId = midiClockSchedulerRunIdRef.current + 1;
      midiClockSchedulerRunIdRef.current = runId;
      const now = ctx.currentTime;
      const tickNow = getTickIntAtAudioNow(now);
      let nextTick =
        Math.ceil(tickNow / MIDI_CLOCK_TICK_INTERVAL) * MIDI_CLOCK_TICK_INTERVAL;
      for (let i = 0; i < 64; i++) {
        if (mapGlobalTickToAudioTime(nextTick) >= now - 0.01) break;
        nextTick += MIDI_CLOCK_TICK_INTERVAL;
      }
      midiClockNextGlobalTickRef.current = nextTick;
      runMidiClockSchedulerRef.current = runMidiClockScheduler;
      runMidiClockScheduler(runId);
      const WorkerCtor = TransportPulseWorker as unknown as { new (): Worker };
      const w = new WorkerCtor();
      w.onmessage = () => {
        runMidiClockSchedulerRef.current(runId);
      };
      w.postMessage({
        cmd: 'start',
        intervalMs: Math.max(8, METRONOME_LOOKAHEAD_MS),
      });
      midiClockPulseWorkerRef.current = w;
    } catch (e) {
      console.debug('MIDI clock lookahead start error:', e);
    }
  }, [getOrCreateAudioContext, getTickIntAtAudioNow, mapGlobalTickToAudioTime, runMidiClockScheduler]);

  const stopMidiClockLoop = useCallback(() => {
    midiClockSchedulerRunIdRef.current += 1;
    if (midiClockPulseWorkerRef.current) {
      midiClockPulseWorkerRef.current.postMessage({ cmd: 'stop' });
      midiClockPulseWorkerRef.current.terminate();
      midiClockPulseWorkerRef.current = null;
    }
  }, []);

  const stopMetronomeLoop = useCallback(() => {
    metronomeSchedulerRunIdRef.current += 1;
    metronomeActiveRef.current = false;
    if (metronomePulseWorkerRef.current) {
      try {
        metronomePulseWorkerRef.current.postMessage({ cmd: 'stop' });
        metronomePulseWorkerRef.current.terminate();
      } catch {
        /* ignore */
      }
      metronomePulseWorkerRef.current = null;
    }
  }, []);

  useEffect(() => {
    runMetronomeSchedulerRef.current = runMetronomeScheduler;
  }, [runMetronomeScheduler]);

  useEffect(() => {
    runMidiClockSchedulerRef.current = runMidiClockScheduler;
  }, [runMidiClockScheduler]);

  /** Normalize any tick into current loop window [start, start+len) when loop is enabled. */
  const normalizeTickToLoopWindow = useCallback((tick: number) => {
    const tb = ticksPerBarRef.current;
    const loopLen = Math.max(1, loopBarsRef.current * tb);
    const loopStartTickVal = (loopStartBarRef.current - 1) * tb;
    const rel = tick - loopStartTickVal;
    return loopStartTickVal + (((rel % loopLen) + loopLen) % loopLen);
  }, []);

  // ── Stop timer ──────────────────────────────────────────────────────────
  const stopTimer = useCallback(() => {
    isRunningRef.current = false;
    rafRunIdRef.current += 1;
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    playStartTimeRef.current = -1;
    // Do not zero transportBeat*Ref here — pause() sets them to the frozen playhead; stop() zeros explicitly.
    lastUiPublishMsRef.current = 0;
    lastPublishedTransportBeatIntRef.current = null;
    stopMetronomeLoop();
    stopMidiClockLoop();
  }, [stopMetronomeLoop, stopMidiClockLoop]);

  // ── Display state ───────────────────────────────────────────────────────
  interface DisplayState {
    positionTicks: number;
    transportBeatFloat: number;
    currentStep: number;
    currentBar: number;
    // FIX: currentTick is now beat-within-bar (0–3), NOT ticks-mod-bar
    currentTick: number;
    currentMeasure: number;
    songBar: number;
    songStep: number;
    /** `floor(globalBeatsUnwrapped + ε)` — monotonic quarter index, no tick rounding. */
    transportUnwrappedQuarterIndex: number;
    playheadFrac: number;
    songPlayheadFrac: number;
    // FIX: currentBeatInBar is the source of truth for beat display (1–4)
    currentBeatInBar: number;
  }

  const [displayState, setDisplayState] = useState<DisplayState>({
    positionTicks: 0,
    transportBeatFloat: 0,
    currentStep: 0,
    currentBar: 1,
    currentTick: 0,
    currentMeasure: 1,
    songBar: 1,
    songStep: 0,
    transportUnwrappedQuarterIndex: 0,
    playheadFrac: 0,
    songPlayheadFrac: 0,
    currentBeatInBar: 1,
  });

  const [transportTimelineEpoch, setTransportTimelineEpoch] = useState(0);

  /**
   * `setDisplayState` + beat UI from audio time — shared by RAF and `startTimer` so the HUD does not
   * sit one frame behind after precount → record (users hear MET before the tick counter moves).
   */
  const publishTransportVisualFrameAtAudioNow = useCallback(
    (audioNow: number) => {
      const ctx = audioCtxRef.current;
      const loopBarsN = loopBarsRef.current;
      const loopStartB = loopStartBarRef.current;
      const loopOn = loopEnabledRef.current;
      const songTotalB = songTotalBarsRef.current;

      const bpmRun = Math.max(1, bpmRef.current);
      const elapsed = Math.max(0, audioNow - startAudioTimeRef.current);
      const globalBeatsUnwrapped =
        originBeatFloatRef.current + (elapsed * bpmRun) / 60;
      const tickInt = ctx
        ? Math.max(0, Math.round(globalBeatsUnwrapped * PPQ))
        : Math.max(0, Math.round(originBeatFloatRef.current * PPQ));

      tickCounterRef.current = tickInt;
      /** Bar/beat + playhead float — same phase as {@link getDisplayBeatsAtAudioNow} (linear clock + loop wrap). */
      const displayBeats = getDisplayBeatsAtAudioNow(audioNow);
      const displayTickFloat = displayBeats * PPQ;
      const transportBeat = Math.floor(displayBeats + 1e-9);
      /** Unwrapped quarter index — same linear phase as {@link getGlobalBeatsUnwrappedAtAudioNow} / studio playhead (not `round(tick)/PPQ`). */
      const transportUnwrappedQuarterIndex = Math.floor(
        globalBeatsUnwrapped + 1e-9,
      );
      const globalBeat = transportUnwrappedQuarterIndex;

      const transportBeatFloat =
        transportBeatFloatFromDisplayTick(displayTickFloat);
      transportBeatFloatRef.current = transportBeatFloat;
      transportBeatIndexRef.current = transportBeat;
      const studioTimelineBeatFloat =
        getStudioTimelineBeatFloatGridLockedAtAudioNow(audioNow);
      publishTransportBeatUiRef.current(
        transportUnwrappedQuarterIndex,
        transportBeat,
        transportBeatFloat,
        studioTimelineBeatFloat,
      );

      const qpb = ticksPerBarRef.current / PPQ;
      const loopStartBeat = (loopStartB - 1) * qpb;
      const transportStep = loopOn
        ? transportBeat - loopStartBeat
        : globalBeat;
      const tbb = dawTickToBarBeatFromFloat(
        displayTickFloat,
        timeSigsRef.current,
        PPQ,
      );
      const transportBar = tbb.bar;
      const beatInBar = tbb.beat - 1;
      currentBeatInBarRef.current = tbb.beat;
      const songTicks = songTotalB * ticksPerBarRef.current;
      const loopFrac = loopOn
        ? Math.max(
            0,
            Math.min(
              1,
              (transportBeatFloat - loopStartBeat) /
                Math.max(1, loopBarsN * qpb),
            ),
          )
        : songTicks > 0
          ? Math.min(1, tickInt / songTicks)
          : 0;
      const songFrac =
        songTicks > 0 ? Math.min(1, tickInt / songTicks) : 0;

      if (
        import.meta.env.DEV &&
        ctx &&
        typeof window !== 'undefined' &&
        (window as unknown as { __DA_DEBUG_TRANSPORT__?: boolean })
          .__DA_DEBUG_TRANSPORT__
      ) {
        const t = performance.now();
        if (t - __daTransportDebugLastLogMs >= 250) {
          __daTransportDebugLastLogMs = t;
          debugTransportSyncTruth({
            audioCtx: ctx,
            sessionStartTime: startAudioTimeRef.current,
            bpm: bpmRun,
            originBeats: originBeatFloatRef.current,
            totalBeatsUnwrapped: globalBeatsUnwrapped,
            displayBeats,
            dawBar: transportBar,
            dawBeatInBar: tbb.beat,
            phraseBars: 4,
          });
        }
      }

      lastPublishedTransportBeatIntRef.current = transportBeat;
      lastUiPublishMsRef.current = audioNow * 1000;
      setDisplayState({
        positionTicks: tickInt,
        transportBeatFloat: transportBeatFloat,
        currentStep: transportStep,
        currentBar: transportBar,
        currentTick: beatInBar,
        currentMeasure: transportBar,
        songBar: transportBar,
        songStep: transportBeat,
        transportUnwrappedQuarterIndex,
        playheadFrac: loopFrac,
        songPlayheadFrac: songFrac,
        currentBeatInBar: beatInBar + 1,
      });
    },
    [getDisplayBeatsAtAudioNow, getStudioTimelineBeatFloatGridLockedAtAudioNow],
  );

  // ── RAF loop ────────────────────────────────────────────────────────────
  /**
   * Transport UI every frame: `originBeatFloat + (audioCtx.currentTime - sessionStart) * bpm / 60`, then
   * loop wrap — not `Date.now`, not incremental measure++, not drift from laggy `+=` counters.
   */
  const rafLoopRef = useRef<(runId: number) => void>(() => {});

  rafLoopRef.current = (runId: number) => {
    // UI tick publishing must never freeze while the master transport is running.
    // `runId` guards are useful to prevent duplicate loops, but in some cases they can
    // prevent state publishing (UI stuck) while the metronome scheduler continues.
    // Since `startTimer()`/`stopTimer()` already cancel previous RAF callbacks,
    // we only gate on `isRunningRef`.
    if (!isRunningRef.current) return;
    try {
      const ctx = audioCtxRef.current;
      if (ctx && ctx.sampleRate !== sampleRateRef.current) {
        sampleRateRef.current = ctx.sampleRate;
      }

      // Transport UI first; then a cheap metronome refill so a stalled worker interval cannot drain the
      // click buffer (~1s). Worker is still primary for sub-frame timing when the main thread is busy.
      const audioNow = ctx ? ctx.currentTime : 0;
      publishTransportVisualFrameAtAudioNow(audioNow);
      if (metronomeActiveRef.current && metronomeRef.current) {
        runMetronomeSchedulerRef.current();
      }
    } catch (e) {
      console.error('RAF loop error:', e);
    } finally {
      // Must always re-arm rAF: a throw above used to strand the chain — metronome lookahead drained
      // (~0.5s) while isRunning stayed true → silent “skipping” until play/pause.
      if (isRunningRef.current) {
        rafRef.current = requestAnimationFrame(() =>
          rafLoopRef.current(runId),
        );
      }
    }
  };

  // ── Start timer ─────────────────────────────────────────────────────────
  const startTimer = useCallback((
    initialTick = 0,
    opts?: { metronomeBeat0AudioTime?: number },
  ) => {
    stopTimer();
    // Keep transport clock monotonic; loop affects windowing/display, not clock anchors.
    const startTick = initialTick;

    tickCounterRef.current = startTick;
    isRunningRef.current = true;
    lastUiPublishMsRef.current = 0;
    lastPublishedTransportBeatIntRef.current = null;
    originBeatFloatRef.current = startTick / PPQ;
    originTickRef.current = startTick;
    const dStart = wrapGlobalBeatsToDisplayFloat(originBeatFloatRef.current) * PPQ;
    transportBeatFloatRef.current = transportBeatFloatFromDisplayTick(dStart);
    transportBeatIndexRef.current = Math.floor(dStart / PPQ);
    currentBeatInBarRef.current = dawTickToBarBeatFromFloat(
      dStart,
      timeSigsRef.current,
      PPQ,
    ).beat;

    const ctx = getOrCreateAudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    (window as unknown as { __daMusicAudioCtx?: AudioContext }).__daMusicAudioCtx = ctx;

    const ctxNow = ctx.currentTime;
    const beat0 = opts?.metronomeBeat0AudioTime;
    const usePrecountAlign =
      typeof beat0 === 'number' &&
      Number.isFinite(beat0) &&
      beat0 <= ctxNow + 2;
    // Default: anchor "now". When continuing from precount clicks at t0+i*spb, anchor to the grid
    // instant for this tick so the metronome does not phase-shift after the await/event loop gap.
    startAudioTimeRef.current = usePrecountAlign ? beat0 : ctxNow;

    sampleRateRef.current = ctx.sampleRate;
    playStartTimeRef.current = ctxNow;

    const metronomeAnchorTick = startTick;
    if (usePrecountAlign && typeof beat0 === 'number') {
      const bpm = Math.max(1, bpmRef.current);
      /* `record()` often runs after the notional downbeat (`beat0`). Keeping origin at startTick/PPQ
       * makes `round(beats*PPQ)` jump ahead of the playhead; nudge origin back by the slip in beats
       * so at `ctxNow` the clock still reads `startTick` while `mapGlobalTickToAudioTime(startTick)`
       * stays `ctxNow` and quarter spacing stays locked to the precount grid. */
      const slipSec = Math.max(0, ctxNow - beat0);
      const slipBeats = (slipSec * bpm) / 60;
      originBeatFloatRef.current = startTick / PPQ - slipBeats;
      const beatsAtCtx =
        originBeatFloatRef.current +
        (Math.max(0, ctxNow - startAudioTimeRef.current) * bpm) / 60;
      const displayBeats = wrapGlobalBeatsToDisplayFloat(beatsAtCtx);
      const displayTickFloat = displayBeats * PPQ;
      const transportBeat = Math.floor(displayBeats + 1e-9);
      tickCounterRef.current = Math.max(0, Math.round(beatsAtCtx * PPQ));
      originTickRef.current = tickCounterRef.current;
      transportBeatFloatRef.current =
        transportBeatFloatFromDisplayTick(displayTickFloat);
      transportBeatIndexRef.current = transportBeat;
      currentBeatInBarRef.current = dawTickToBarBeatFromFloat(
        displayTickFloat,
        timeSigsRef.current,
        PPQ,
      ).beat;
    }

    // Publish playhead before metronome: startMetronomeLoop schedules clicks synchronously
    // (precount downbeat + first lookahead) and should not run before beat UI subscribers update.
    publishTransportVisualFrameAtAudioNow(ctx.currentTime);

    if (metronomeRef.current) {
      startMetronomeLoop(
        bpmRef.current,
        usePrecountAlign
          ? { metronomeAnchorTick }
          : undefined,
      );
    }

    const rafRunId = rafRunIdRef.current + 1;
    rafRunIdRef.current = rafRunId;
    rafRef.current = requestAnimationFrame(() =>
      rafLoopRef.current(rafRunId),
    );
  }, [
    getOrCreateAudioContext,
    publishTransportVisualFrameAtAudioNow,
    startMetronomeLoop,
    stopTimer,
    wrapGlobalBeatsToDisplayFloat,
  ]);

  // ── Transport controls ──────────────────────────────────────────────────
  const play = useCallback(() => {
    void (async () => {
      if (transportRef.current === 'counting' || countInPhaseRef.current) return;
      try {
        const ctx = getOrCreateAudioContext();
        if (ctx.state === 'suspended') await ctx.resume();
        const master = masterGainRef.current;
        if (master && master.context === ctx) {
          const now = ctx.currentTime;
          const target = Math.max(
            0.0001,
            Math.min(1, masterOutputLinearRef.current),
          );
          // Anti-click: tiny fade-in when transport starts/resumes.
          master.gain.cancelScheduledValues(now);
          master.gain.setValueAtTime(0.0001, now);
          master.gain.exponentialRampToValueAtTime(target, now + 0.02);
        }
      } catch (e) {
        console.warn('[MasterClock] play: AudioContext resume failed', e);
      }
      if (midiClockEnabledRef.current && midiOutputRef.current) {
        const wasPaused = transportRef.current === 'paused';
        sendMidiSongPositionPointer(tickCounterRef.current || 0);
        sendMidiRealtimeRef.current(wasPaused ? 0xfb : 0xfa);
      }
      setTransport('playing');
      startTimer(tickCounterRef.current || 0);
      if (midiClockEnabledRef.current && midiOutputRef.current) {
        startMidiClockLoop();
      }
    })();
  }, [startTimer, getOrCreateAudioContext, startMidiClockLoop]);

  const record = useCallback((opts?: RecordInvokeOptions) => {
    void (async () => {
      // DAW model: arm = getUserMedia; registered in app.tsx while Studio / Creation Station / Master Arranger is active.
      const arm = (
        window as unknown as {
          __daMusicStudioRecordArm?: () => Promise<void>;
        }
      ).__daMusicStudioRecordArm;
      if (typeof arm !== 'function') {
        console.warn(
          '[MasterClock] Record requires a DAW recording screen. Open Studio Editor, Creation Station, or Master Arranger, then press Record.',
        );
        return;
      }
      try {
        await arm();
      } catch (e) {
        console.warn(
          '[MasterClock] Recording arm failed (microphone permission or device). Transport will not enter recording.',
          e,
        );
        return;
      }

      const preFlight = (
        window as unknown as {
          __daMusicStudioRecordPreFlight?: () => boolean;
        }
      ).__daMusicStudioRecordPreFlight;
      if (typeof preFlight === 'function' && preFlight() === false) {
        console.warn(
          '[MasterClock] Recording blocked: Studio requires a record-armed track. Click ARM on a track, then Record.',
        );
        const wMic = window as unknown as {
          __daMusicStudioMicStream?: MediaStream | null;
        };
        const s = wMic.__daMusicStudioMicStream;
        if (s) {
          s.getTracks().forEach((tr) => tr.stop());
          wMic.__daMusicStudioMicStream = null;
        }
        return;
      }

      const ctxRecord = getOrCreateAudioContext();
      try {
        for (let i = 0; i < 6 && ctxRecord.state === 'suspended'; i++) {
          await ctxRecord.resume();
        }
      } catch (e) {
        console.warn('[MasterClock] record: AudioContext resume failed', e);
      }

    const countInOn =
      opts?.countIn !== undefined ? opts.countIn : countInEnabledRef.current;
    const beatsForCount =
      opts?.countInBeats !== undefined
        ? opts.countInBeats
        : countInBeatsRef.current;
    const countQuarters = Math.max(
      1,
      Math.min(16, Math.round(beatsForCount)),
    );

    const primeMasterBusForRecord = () => {
      try {
        const ctx = getOrCreateAudioContext();
        const master = masterGainRef.current;
        if (!master || master.context !== ctx) return;
        const now = ctx.currentTime;
        const target = Math.max(
          0.0001,
          Math.min(1, masterOutputLinearRef.current),
        );
        master.gain.cancelScheduledValues(now);
        master.gain.setValueAtTime(0.0001, now);
        master.gain.exponentialRampToValueAtTime(target, now + 0.02);
      } catch {
        /* non-fatal — count-in clicks still route to ctx.destination if master fails */
      }
    };

    if (countInOn) {
      primeMasterBusForRecord();
      countInPhaseRef.current = true;
      setTransport('counting');
      /* Ref must match immediately — layout effect syncs `transport` → ref; count-in wait uses countInPhaseRef. */
      transportRef.current = 'counting';
      const countStartTick = tickCounterRef.current || 0;
      const ctx = getOrCreateAudioContext();
      const spb = 60 / Math.max(1, bpmRef.current);
      const t0 = ctx.currentTime;
      setCountDownTicks(countQuarters * PPQ);
      const metroClick = playMetronomeClickAtRef.current;
      /* Same downbeat rule as {@link runMetronomeScheduler} — bar/beat from song + loop wrap, not i%4. */
      for (let i = 0; i < countQuarters; i++) {
        const tickAtClick = countStartTick - (countQuarters - i) * PPQ;
        const displayTick = wrapGlobalTickToDisplayTick(Math.max(0, tickAtClick));
        const { beat } = dawTickToBarBeat(displayTick, timeSigsRef.current, PPQ);
        metroClick(t0 + i * spb, beat === 1);
      }
      const deadline = t0 + countQuarters * spb;
      const tickIv =
        countQuarters > 1
          ? setInterval(() => {
              setCountDownTicks((prev) => Math.max(0, prev - PPQ));
            }, spb * 1000)
          : null;
      const wallGiveUpMs =
        performance.now() + countQuarters * spb * 1000 + 600;
      try {
        await new Promise<void>((resolve) => {
          const step = () => {
            if (!countInPhaseRef.current) {
              resolve();
              return;
            }
            if (ctx.state === 'suspended') void ctx.resume();
            if (
              ctx.currentTime >= deadline - 0.002 ||
              performance.now() >= wallGiveUpMs
            ) {
              resolve();
              return;
            }
            requestAnimationFrame(step);
          };
          requestAnimationFrame(step);
        });
      } finally {
        countInPhaseRef.current = false;
      }
      if (tickIv != null) clearInterval(tickIv);
      setCountDownTicks(0);
      if (transportRef.current !== 'counting') {
        return;
      }
      setTransport('recording');
      transportRef.current = 'recording';
      startTimer(countStartTick, { metronomeBeat0AudioTime: deadline });
    } else {
      const alignT = opts?.metronomeBeat0AudioTime;
      const hasPrecountHandoff =
        typeof alignT === 'number' && Number.isFinite(alignT);
      /* `primeMasterBusForRecord` ramps from ~silence over 20ms — correct for a cold record start, but
       * after Studio precount the MET already ran through master; that mute hides the first transport
       * quarter so clicks feel a beat “late”. */
      if (!hasPrecountHandoff) {
        primeMasterBusForRecord();
      } else {
        try {
          const ctx = getOrCreateAudioContext();
          const master = masterGainRef.current;
          if (master && master.context === ctx) {
            const now = ctx.currentTime;
            const target = Math.max(
              0.0001,
              Math.min(1, masterOutputLinearRef.current),
            );
            master.gain.cancelScheduledValues(now);
            master.gain.setValueAtTime(target, now);
          }
        } catch {
          /* ignore */
        }
      }
      setTransport('recording');
      transportRef.current = 'recording';
      const startT =
        typeof opts?.recordStartTick === 'number' &&
        Number.isFinite(opts.recordStartTick)
          ? Math.max(0, Math.round(opts.recordStartTick))
          : tickCounterRef.current || 0;
      tickCounterRef.current = startT;
      startTimer(
        startT,
        hasPrecountHandoff
          ? { metronomeBeat0AudioTime: alignT as number }
          : undefined,
      );
    }
    if (midiClockEnabledRef.current && midiOutputRef.current) {
      sendMidiSongPositionPointer(tickCounterRef.current || 0);
      sendMidiRealtimeRef.current(0xfa);
      startMidiClockLoop();
    }
    // Studio timeline: clip start bar must match tick at record start (after startTimer), not playhead at stop.
    (
      window as unknown as { __daMusicStudioRecordStartTick?: number }
    ).__daMusicStudioRecordStartTick = tickCounterRef.current;
    try {
      (
        window as unknown as { __daMusicStudioTryStartMediaCapture?: () => void }
      ).__daMusicStudioTryStartMediaCapture?.();
    } catch (e) {
      console.warn('[MasterClock] Studio sync MediaRecorder start failed', e);
    }
    })();
  }, [
    startTimer,
    getOrCreateAudioContext,
    startMidiClockLoop,
    sendMidiSongPositionPointer,
    wrapGlobalTickToDisplayTick,
  ]);

  const pause = useCallback(() => {
    if (transportRef.current === 'counting') {
      countInPhaseRef.current = false;
      transportRef.current = 'stopped';
      setTransport('stopped');
      setCountDownTicks(0);
      stopTimer();
      return;
    }
    const ac = audioCtxRef.current;
    if (ac) {
      // Freeze `originBeatFloatRef` from elapsed audio time **before** re-anchoring `startAudioTimeRef`.
      const audioNowPause = ac.currentTime;
      const bpmPause = Math.max(1, bpmRef.current);
      const elapsedPause = Math.max(0, audioNowPause - startAudioTimeRef.current);
      const globalBeatsFrozen =
        originBeatFloatRef.current + (elapsedPause * bpmPause) / 60;
      const tickInt = Math.max(0, Math.round(globalBeatsFrozen * PPQ));
      startAudioTimeRef.current = audioNowPause;
      originBeatFloatRef.current = globalBeatsFrozen;
      originTickRef.current = tickInt;
      tickCounterRef.current = tickInt;

      const loopOn = loopEnabledRef.current;
      const loopBarsN = loopBarsRef.current;
      const loopStartB = loopStartBarRef.current;
      const qpb = ticksPerBarRef.current / PPQ;
      const loopStartBeat = (loopStartB - 1) * qpb;
      const displayBeats = wrapGlobalBeatsToDisplayFloat(globalBeatsFrozen);
      const displayTickFloat = displayBeats * PPQ;
      const transportBeat = Math.floor(displayBeats + 1e-9);
      const uPause = Math.floor(globalBeatsFrozen + 1e-9);
      const globalBeat = uPause;
      const transportBeatFloat =
        transportBeatFloatFromDisplayTick(displayTickFloat);
      const transportStep = loopOn
        ? transportBeat - loopStartBeat
        : globalBeat;
      const tbb = dawTickToBarBeatFromFloat(
        displayTickFloat,
        timeSigsRef.current,
        PPQ,
      );
      const transportBar = tbb.bar;
      const beatInBar = tbb.beat - 1;
      const tb = ticksPerBarRef.current;
      const songTicks = songTotalBarsRef.current * tb;
      const loopTicks = Math.max(1, loopBarsN * tb);
      const loopFrac = loopOn
        ? Math.max(
            0,
            Math.min(
              1,
              (transportBeatFloat - loopStartBeat) /
                Math.max(1, loopBarsN * qpb),
            ),
          )
        : songTicks > 0
          ? Math.min(1, tickInt / songTicks)
          : 0;
      const songFrac =
        songTicks > 0 ? Math.min(1, tickInt / songTicks) : 0;

      transportBeatFloatRef.current = transportBeatFloat;
      transportBeatIndexRef.current = transportBeat;
      currentBeatInBarRef.current = tbb.beat;
      let nextMq = Math.ceil(tickInt / PPQ) * PPQ;
      for (let i = 0; i < 64; i++) {
        if (mapGlobalTickToAudioTime(nextMq) >= audioNowPause - 0.005) break;
        nextMq += PPQ;
      }
      metronomeNextQuarterTickRef.current = nextMq;
      metronomeBeatIndexRef.current = Math.floor(
        metronomeNextQuarterTickRef.current / PPQ,
      );
      metronomeNextBeatTimeRef.current = mapGlobalTickToAudioTime(
        metronomeNextQuarterTickRef.current,
      );
      lastPublishedTransportBeatIntRef.current = transportBeat;
      // stopTimer before publish so isRunning is false — otherwise ±1 throttle (if reintroduced)
      // could freeze beat UI vs frozen tick until resume.
      stopTimer();
      setDisplayState({
        positionTicks: tickInt,
        transportBeatFloat,
        currentStep: transportStep,
        currentBar: transportBar,
        currentTick: beatInBar,
        currentMeasure: transportBar,
        songBar: transportBar,
        songStep: transportBeat,
        transportUnwrappedQuarterIndex: uPause,
        playheadFrac: loopFrac,
        songPlayheadFrac: songFrac,
        currentBeatInBar: beatInBar + 1,
      });
      const studioTimelineBeatFloat =
        getStudioTimelineBeatFloatGridLockedAtAudioNow(audioNowPause);
      publishTransportBeatUiRef.current(
        uPause,
        transportBeat,
        transportBeatFloat,
        studioTimelineBeatFloat,
      );
    }
    setTransport('paused');
    transportRef.current = 'paused';
    stopTimer();
    if (midiClockEnabledRef.current && midiOutputRef.current) {
      sendMidiRealtimeRef.current(0xfc);
    }
    if (ac && ac.state !== 'closed') void ac.suspend().catch(() => {});
  }, [
    stopTimer,
    wrapGlobalBeatsToDisplayFloat,
    wrapGlobalTickToDisplayTick,
    mapGlobalTickToAudioTime,
    getStudioTimelineBeatFloatGridLockedAtAudioNow,
  ]);

  const stop = useCallback(() => {
    countInPhaseRef.current = false;
    stopTimer();
    startAudioTimeRef.current = 0;
    originBeatFloatRef.current = 0;
    originTickRef.current = 0;
    setTransport('stopped');
    transportRef.current = 'stopped';
    setCountDownTicks(0);
    tickCounterRef.current = 0;
    transportBeatFloatRef.current = 0;
    transportBeatIndexRef.current = 0;
    currentBeatInBarRef.current = 1;
    metronomeNextQuarterTickRef.current = 0;
    metronomeBeatIndexRef.current = 0;
    metronomeNextBeatTimeRef.current = 0;
    lastUiPublishMsRef.current = 0;
    setDisplayState({
      positionTicks: 0,
      transportBeatFloat: 0,
      currentStep: 0,
      currentBar: loopStartBarRef.current,
      currentTick: 0,
      currentMeasure: 1,
      songBar: loopStartBarRef.current,
      songStep: 0,
      transportUnwrappedQuarterIndex: 0,
      playheadFrac: 0,
      songPlayheadFrac: 0,
      currentBeatInBar: 1,
    });
    publishTransportBeatUiRef.current(0, 0, 0, 0);
    if (midiClockEnabledRef.current && midiOutputRef.current) {
      sendMidiRealtimeRef.current(0xfc);
    }
    const ac = audioCtxRef.current;
    if (ac && ac.state !== 'closed') void ac.suspend().catch(() => {});
  }, [stopTimer]);

  const seekToTick = useCallback((tick: number) => {
    const loopOn = loopEnabledRef.current;
    const tb = ticksPerBarRef.current;
    const qpb = tb / PPQ;
    const loopTicks = Math.max(1, loopBarsRef.current * tb);
    const targetTick = tick;

    const wasRunning =
      transportRef.current === 'playing' ||
      transportRef.current === 'recording';
    if (wasRunning) stopTimer();

    tickCounterRef.current = targetTick;
    originBeatFloatRef.current = targetTick / PPQ;
    originTickRef.current = targetTick;

    const beatGlobalSeek = Math.floor(targetTick / PPQ);
    const displayTickSeek = wrapGlobalTickToDisplayTickFloat(targetTick);
    const transportBeatSeek = Math.floor(displayTickSeek / PPQ);
    const transportBeatSeekFloat =
      transportBeatFloatFromDisplayTick(displayTickSeek);
    const tbbSeek = dawTickToBarBeatFromFloat(
      displayTickSeek,
      timeSigsRef.current,
      PPQ,
    );
    const transportBarSeek = tbbSeek.bar;
    const loopStartBeatSeek = (loopStartBarRef.current - 1) * qpb;
    const transportStepSeek = loopOn
      ? transportBeatSeek - loopStartBeatSeek
      : beatGlobalSeek;
    const loopFrac = loopOn
      ? loopTicks > 0
        ? Math.max(
            0,
            Math.min(
              1,
              (transportBeatSeekFloat - loopStartBeatSeek) /
                Math.max(1, loopBarsRef.current * qpb),
            ),
          )
        : 0
      : songTotalBarsRef.current * tb > 0
        ? Math.min(1, targetTick / (songTotalBarsRef.current * tb))
        : 0;
    const songTicksSeek = songTotalBarsRef.current * tb;
    const songFracSeek =
      songTicksSeek > 0 ? Math.min(1, targetTick / songTicksSeek) : 0;

    const beatInBar = tbbSeek.beat - 1;

    transportBeatFloatRef.current = transportBeatSeekFloat;
    transportBeatIndexRef.current = transportBeatSeek;
    currentBeatInBarRef.current = tbbSeek.beat;
    metronomeNextQuarterTickRef.current = Math.ceil(targetTick / PPQ) * PPQ;
    metronomeBeatIndexRef.current = Math.floor(
      metronomeNextQuarterTickRef.current / PPQ,
    );
    metronomeNextBeatTimeRef.current = mapGlobalTickToAudioTime(
      metronomeNextQuarterTickRef.current,
    );
    lastUiPublishMsRef.current = 0;
    lastPublishedTransportBeatIntRef.current = transportBeatSeek;

    setDisplayState({
      positionTicks: targetTick,
      transportBeatFloat: transportBeatSeekFloat,
      currentStep: transportStepSeek,
      currentBar: transportBarSeek,
      currentTick: beatInBar, // FIX: beat-within-bar (0–3)
      currentMeasure: transportBarSeek,
      songBar: transportBarSeek,
      songStep: transportBeatSeek,
      transportUnwrappedQuarterIndex: beatGlobalSeek,
      playheadFrac: loopFrac,
      songPlayheadFrac: songFracSeek,
      currentBeatInBar: beatInBar + 1, // FIX: 1-indexed (1–4)
    });
    const studioTimelineBeatFloat =
      transportBeatFloatFromDisplayTick(targetTick);
    publishTransportBeatUiRef.current(
      beatGlobalSeek,
      transportBeatSeek,
      transportBeatSeekFloat,
      studioTimelineBeatFloat,
    );
    setTransportTimelineEpoch((e) => e + 1);
    if (midiClockEnabledRef.current && midiOutputRef.current) {
      sendMidiSongPositionPointer(targetTick);
      if (wasRunning) {
        sendMidiRealtimeRef.current(0xfb);
      }
    }
    if (wasRunning) {
      startTimer(targetTick);
    }
  }, [startTimer, stopTimer, wrapGlobalTickToDisplayTickFloat, sendMidiSongPositionPointer]);

  // ── BPM change ──────────────────────────────────────────────────────────
  const setBpm = useCallback(
    (raw: number, opts?: { fromLink?: boolean }) => {
      try {
        const v = Math.max(20, Math.min(300, raw));
        // Ignore sub‑tick float jitter — each real setBpm restarts RAF/metronome while playing.
        if (Math.abs(v - bpmRef.current) < 0.05) {
          return;
        }

        const oldBpm = bpmRef.current;
        const playingOrRec =
          transportRef.current === 'playing' ||
          transportRef.current === 'recording';

        if (playingOrRec) {
          if (midiClockEnabledRef.current && midiOutputRef.current) {
            stopMidiClockLoop();
          }
          stopMetronomeLoop();

          if (timerRef.current !== null) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
          }
          if (rafRef.current !== null) {
            cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
          }

          const ctx = audioCtxRef.current;
          if (ctx) {
            const now = ctx.currentTime;
            const elapsed = Math.max(0, now - startAudioTimeRef.current);
            const beatsAtNow =
              originBeatFloatRef.current + (elapsed * oldBpm) / 60;
            originBeatFloatRef.current = beatsAtNow;
            const snappedTick = Math.max(0, Math.round(beatsAtNow * PPQ));
            originTickRef.current = snappedTick;
            tickCounterRef.current = snappedTick;
            startAudioTimeRef.current = now;
            playStartTimeRef.current = now;
          }

          lastMetronomeBeatRef.current = -1;
        }

        bpmRef.current = v;
        secondsPerStepRef.current = 60 / v / 4;
        setBpmState(v);
        setTempoMapState((prev) => {
          if (prev.length === 1 && prev[0].tick === 0)
            return [{ tick: 0, bpm: v }];
          return prev;
        });
        tempoMapRef.current = [{ tick: 0, bpm: v }];

        if (playingOrRec) {
          const snapped = tickCounterRef.current;
          let nextMq = Math.ceil(snapped / PPQ) * PPQ;
          const ctxBpm = audioCtxRef.current;
          if (ctxBpm) {
            const nowBpm = ctxBpm.currentTime;
            for (let i = 0; i < 64; i++) {
              if (mapGlobalTickToAudioTime(nextMq) >= nowBpm - 0.02) break;
              nextMq += PPQ;
            }
          }
          metronomeNextQuarterTickRef.current = nextMq;
          metronomeBeatIndexRef.current = Math.floor(
            metronomeNextQuarterTickRef.current / PPQ,
          );
          metronomeNextBeatTimeRef.current = mapGlobalTickToAudioTime(
            metronomeNextQuarterTickRef.current,
          );

          const rafRunId = rafRunIdRef.current + 1;
          rafRunIdRef.current = rafRunId;
          rafRef.current = requestAnimationFrame(() =>
            rafLoopRef.current(rafRunId),
          );

          if (metronomeRef.current) {
            startMetronomeLoop(v);
          }
          if (midiClockEnabledRef.current && midiOutputRef.current) {
            startMidiClockLoop();
          }
        }
      } catch (e) {
        console.error('BPM change error:', e);
      }
    },
    [stopMetronomeLoop, startMetronomeLoop, mapGlobalTickToAudioTime, stopMidiClockLoop, startMidiClockLoop],
  );

  // ── Loop bars ───────────────────────────────────────────────────────────
  const setLoopBars = useCallback((v: number) => {
    loopBarsRef.current = v;
    loopStepsRef.current = v * STEPS_PER_BAR;
    setLoopBarsState(v);
    setLoopProfiles((prev) => applyLoopPatchAll(prev, { bars: v }));
  }, []);

  const setLoopEnabled = useCallback((v: boolean) => {
    loopEnabledRef.current = v;
    setLoopEnabledState(v);
    setLoopProfiles((prev) => applyLoopPatchAll(prev, { enabled: v }));
  }, []);

  const setLoopStartBar = useCallback((v: number) => {
    loopStartBarRef.current = v;
    setLoopStartBarState(v);
    setLoopProfiles((prev) => applyLoopPatchAll(prev, { startBar: v }));
  }, []);

  const setLoopRange = useCallback(
    (startBar: number, endBar: number, section?: string | null) => {
      const start = Math.max(1, Math.min(startBar, endBar));
      const end = Math.max(startBar, endBar);
      const lengthBars = end - start + 1;
      loopStartBarRef.current = start;
      loopBarsRef.current = lengthBars;
      loopStepsRef.current = lengthBars * STEPS_PER_BAR;
      loopEnabledRef.current = true;
      setLoopStartBarState(start);
      setLoopBarsState(lengthBars);
      setLoopEnabledState(true);
      setLoopProfiles((prev) => {
        const resolvedSection =
          section === undefined
            ? (prev[activeLoopModule]?.section ?? null)
            : section;
        return applyLoopPatchAll(prev, {
          enabled: true,
          bars: lengthBars,
          startBar: start,
          section: resolvedSection,
        });
      });
    },
    [activeLoopModule],
  );

  const setLoopGeometry = useCallback(
    (startBar: number, endBar: number, section?: string | null) => {
      const start = Math.max(1, Math.min(startBar, endBar));
      const end = Math.max(startBar, endBar);
      const lengthBars = end - start + 1;
      loopStartBarRef.current = start;
      loopBarsRef.current = lengthBars;
      loopStepsRef.current = lengthBars * STEPS_PER_BAR;
      setLoopStartBarState(start);
      setLoopBarsState(lengthBars);
      setLoopProfiles((prev) => {
        const resolvedSection =
          section === undefined
            ? (prev[activeLoopModule]?.section ?? null)
            : section;
        return applyLoopPatchAll(prev, {
          startBar: start,
          bars: lengthBars,
          section: resolvedSection,
        });
      });
    },
    [activeLoopModule],
  );

  const clearLoop = useCallback(() => {
    loopEnabledRef.current = false;
    setLoopEnabledState(false);
    setLoopProfiles((prev) => applyLoopPatchAll(prev, { enabled: false }));
  }, []);

  const setActiveLoopModule = useCallback((m: LoopModuleId) => {
    setActiveLoopModuleState(m);
  }, []);

  /**
   * On mount, align React loop state + refs with the **Creation Station** row (transport anchor).
   * After that, `setLoop*` / `setLoopRange` keep refs and profiles in sync; we do not depend on navigation.
   */
  useEffect(() => {
    const profile = loopProfiles['creation-station'];
    if (!profile) return;
    loopEnabledRef.current = profile.enabled;
    loopBarsRef.current = profile.bars;
    loopStepsRef.current = profile.bars * STEPS_PER_BAR;
    loopStartBarRef.current = profile.startBar;
    setLoopEnabledState(profile.enabled);
    setLoopBarsState(profile.bars);
    setLoopStartBarState(profile.startBar);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional once; ongoing updates use setters + applyLoopPatchAll
  }, []);

  // ── Tempo / time-sig maps ───────────────────────────────────────────────
  const setTempoMap = useCallback((m: TempoEvent[]) => {
    const sorted = [...m].sort((a, b) => a.tick - b.tick);
    tempoMapRef.current = sorted;
    setTempoMapState(sorted);
    if (sorted[0]) {
      bpmRef.current = sorted[0].bpm;
      setBpmState(sorted[0].bpm);
    }
  }, []);

  const setTimeSigs = useCallback((m: TimeSigEvent[]) => {
    const sorted = [...m].sort((a, b) => a.tick - b.tick);
    timeSigsRef.current = sorted;
    setTimeSigsState(sorted);
  }, []);

  const addTempoEvent = useCallback((ev: TempoEvent) => {
    setTempoMapState((prev) => {
      const next = [...prev.filter((e) => e.tick !== ev.tick), ev].sort(
        (a, b) => a.tick - b.tick,
      );
      tempoMapRef.current = next;
      return next;
    });
  }, []);

  const addTimeSigEvent = useCallback((ev: TimeSigEvent) => {
    setTimeSigsState((prev) => {
      const next = [...prev.filter((e) => e.tick !== ev.tick), ev].sort(
        (a, b) => a.tick - b.tick,
      );
      timeSigsRef.current = next;
      return next;
    });
  }, []);

  // ── Utility callbacks ───────────────────────────────────────────────────
  const ticksToSecondsLocal = useCallback(
    (ticks: number) => ticksToSeconds(ticks, tempoMapRef.current),
    [],
  );
  const secondsToTicksLocal = useCallback(
    (secs: number) => secondsToTicks(secs, tempoMapRef.current),
    [],
  );
  const tickToBarBeatLocal = useCallback(
    (tick: number) =>
      tickToBarBeat(tick, timeSigsRef.current, PPQ),
    [],
  );

  const quantizeTicks = quantizeValueToTicks(quantize);
  const snapTickLocal = useCallback(
    (tick: number) => {
      if (!snapEnabled) return tick;
      return snapTick(tick, quantizeTicks, quantizeStrength);
    },
    [snapEnabled, quantizeTicks, quantizeStrength],
  );

  // ── Drum sounds ─────────────────────────────────────────────────────────
  const playDrumSound = useCallback((chId: number, velocity: number, baseTimeSec?: number) => {
    try {
      const ctx = getOrCreateAudioContext();
      if (ctx.state === 'suspended') {
        void ctx
          .resume()
          .then(() => {
            playDrumSound(chId, velocity, baseTimeSec);
          })
          .catch(() => {
            /* ignore resume failure */
          });
        return;
      }
      const tStart = baseTimeSec ?? (ctx.currentTime + 0.001);
      const vol = (velocity / 127) * 0.4;
      const rawPan =
        ((window as any).__daMusicChannelPans?.[chId] ?? 0) / 100;
      const panNode = ctx.createStereoPanner();
      panNode.pan.value = Math.max(-1, Math.min(1, rawPan));
      const master = masterGainRef.current;
      const dest =
        master && master.context === ctx ? master : ctx.destination;
      panNode.connect(dest);

      let activeOscs = 0;
      const releaseVoice = () => {
        activeOscs -= 1;
        if (activeOscs <= 0) {
          try {
            panNode.disconnect();
          } catch {
            /* */
          }
        }
      };

      const makeOsc = (
        freq: number | null,
        freqEnd: number | null,
        duration: number,
        type: OscillatorType = 'sine',
        volScale = 1,
      ) => {
        activeOscs += 1;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(panNode);
        osc.type = type;
        if (freq !== null)
          osc.frequency.setValueAtTime(freq, tStart);
        if (freqEnd !== null)
          osc.frequency.exponentialRampToValueAtTime(
            freqEnd,
            tStart + duration,
          );
        gain.gain.setValueAtTime(vol * volScale, tStart);
        gain.gain.exponentialRampToValueAtTime(0.01, tStart + duration);
        osc.start(tStart);
        osc.stop(tStart + duration);
        osc.onended = () => {
          try {
            osc.disconnect();
            gain.disconnect();
          } catch {
            /* */
          }
          releaseVoice();
        };
      };

      switch (chId) {
        case 1:
          makeOsc(150, 0.01, 0.5);
          break;
        case 2:
          makeOsc(200, null, 0.15, 'triangle');
          break;
        case 3:
          makeOsc(250, null, 0.12, 'square', 0.8);
          break;
        case 4:
          makeOsc(
            8000 + Math.random() * 4000,
            null,
            0.08,
            'square',
            0.5,
          );
          break;
        case 5:
          makeOsc(
            9000 + Math.random() * 5000,
            null,
            0.3,
            'square',
            0.6,
          );
          break;
        case 6:
          makeOsc(400, 150, 0.1);
          break;
        case 7:
          makeOsc(200, 80, 0.12);
          break;
        case 17:
          makeOsc(80, 30, 0.6);
          break;
        default:
          makeOsc(440 + chId * 50, null, 0.1, 'sine', 0.5);
          break;
      }
    } catch (e) {
      /* AudioContext unavailable */
    }
  }, [getOrCreateAudioContext]);

  const triggerChannel = useCallback(
    (chId: number, velocity: number, when?: number) => {
      const MIN_TRIGGER = 0.02;
      const MIN_AUDIBLE_VELOCITY = 0.12;
      const rawVelocity = Math.max(0, Math.min(1, velocity / 127));
      if (rawVelocity <= MIN_TRIGGER) return;
      const shapedVelocity = Math.pow(rawVelocity, 0.7);
      const safeVelocity = Math.round(
        Math.max(MIN_AUDIBLE_VELOCITY, Math.min(1, shapedVelocity)) * 127,
      );
      const vol = channelVolsRef.current[chId] ?? 80;
      setChannelLevels((prev) => ({
        ...prev,
        [chId]: Math.min(1, (safeVelocity / 127) * (vol / 100)),
      }));
      playDrumSound(chId, safeVelocity, when);
    },
    [playDrumSound],
  );

  const triggerChannelRef = useRef(triggerChannel);
  triggerChannelRef.current = triggerChannel;
  const getOrCreateAudioContextForMidiRef = useRef(getOrCreateAudioContext);
  getOrCreateAudioContextForMidiRef.current = getOrCreateAudioContext;

  const stopMidiInputNote = useCallback((voiceKey: string) => {
    const release = midiInputVoicesRef.current.get(voiceKey);
    if (!release) return;
    release();
    midiInputVoicesRef.current.delete(voiceKey);
  }, []);

  const startMidiInputNote = useCallback(
    (channel: number, note: number, velocity: number) => {
      try {
        const ctx = getOrCreateAudioContextForMidiRef.current();
        if (ctx.state === 'suspended') void ctx.resume();
        const voiceKey = `${channel}:${note}`;
        stopMidiInputNote(voiceKey);
        const now = ctx.currentTime;
        const freq = 440 * Math.pow(2, (note - 69) / 12);
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now);
        const g = Math.max(0.025, Math.min(0.32, (velocity / 127) * 0.26));
        gain.gain.setValueAtTime(g, now);
        const master = masterGainRef.current;
        const dest =
          master && master.context === ctx ? master : ctx.destination;
        osc.connect(gain);
        gain.connect(dest);
        osc.start(now);
        midiInputVoicesRef.current.set(voiceKey, () => {
          const t = ctx.currentTime;
          try {
            gain.gain.cancelScheduledValues(t);
            gain.gain.setValueAtTime(Math.max(1e-4, gain.gain.value), t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
            osc.stop(t + 0.085);
          } catch {
            /* */
          }
          window.setTimeout(() => {
            try {
              osc.disconnect();
              gain.disconnect();
            } catch {
              /* */
            }
          }, 150);
        });
      } catch {
        /* */
      }
    },
    [stopMidiInputNote],
  );

  // Web MIDI: outputs (clock) + inputs (hardware / interface keyboards)
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.requestMIDIAccess) {
      return;
    }

    let cancelled = false;
    const refreshFirstOutput = (access: MIDIAccess) => {
      const outs = access.outputs.values();
      const first = outs.next();
      midiOutputRef.current = first.done ? null : first.value;
    };

    const wireInputs = (access: MIDIAccess) => {
      for (const input of access.inputs.values()) {
        input.onmidimessage = null;
      }
      if (!settings.midiInputEnabled) return;

      const wantId = settings.midiInputDeviceId;
      const handler = (ev: MIDIMessageEvent) => {
        const data = ev.data;
        if (!data || data.length < 2) return;
        const status = data[0]!;
        const cmd = status & 0xf0;
        const ch = status & 0x0f;
        const note = data[1] ?? 0;
        const velRaw = data.length > 2 ? data[2]! : 127;
        const voiceKey = `${ch}:${note}`;

        if (cmd === 0x90) {
          const vel = velRaw;
          if (vel === 0) {
            if (ch !== 9) stopMidiInputNote(voiceKey);
            return;
          }
          if (ch === 9) {
            const drumCh =
              MIDI_DRUM_NOTE_TO_CHANNEL[note] ?? (note % 7) + 1;
            triggerChannelRef.current(drumCh, vel);
          } else {
            startMidiInputNote(ch, note, vel);
          }
        } else if (cmd === 0x80) {
          if (ch !== 9) stopMidiInputNote(voiceKey);
        }
      };

      for (const input of access.inputs.values()) {
        if (wantId !== 'all' && input.id !== wantId) continue;
        input.onmidimessage = handler;
      }
    };

    navigator
      .requestMIDIAccess({ sysex: false })
      .then((access) => {
        if (cancelled) return;
        midiAccessRef.current = access;
        refreshFirstOutput(access);
        access.onstatechange = () => {
          refreshFirstOutput(access);
          wireInputs(access);
        };
        wireInputs(access);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      const access = midiAccessRef.current;
      if (access) {
        for (const input of access.inputs.values()) {
          input.onmidimessage = null;
        }
      }
      midiInputVoicesRef.current.clear();
    };
  }, [
    settings.midiInputEnabled,
    settings.midiInputDeviceId,
    startMidiInputNote,
    stopMidiInputNote,
  ]);

  const setChannelVolume = useCallback((chId: number, vol: number) => {
    setChannelVolumesState((prev) => ({
      ...prev,
      [chId]: vol,
    }));
  }, []);

  // ── Export session ──────────────────────────────────────────────────────
  const exportSession = useCallback(
    (tracks: TrackData[] = []): SessionExport => ({
      ppq: PPQ,
      sampleRate: DEFAULT_SR,
      tempo: tempoMapRef.current,
      timeSigs: timeSigsRef.current,
      tracks,
      transport: {
        positionTicks: tickCounterRef.current,
        isPlaying: transportRef.current === 'playing',
        loop: {
          enabled: loopEnabledRef.current,
          startTick:
            (loopStartBarRef.current - 1) * ticksPerBarRef.current,
          endTick:
            (loopStartBarRef.current - 1 + loopBarsRef.current) *
            ticksPerBarRef.current,
        },
        punch: {
          enabled: false,
          inTick: 0,
          outTick: 0,
        },
        metronome: metronomeRef.current,
      },
    }),
    [],
  );

  // ── Cleanup ─────────────────────────────────────────────────────────────
  /** Do not close AudioContext here — closed refs break transport until reload; stopTimer is enough. */
  useEffect(
    () => () => {
      stopTimer();
    },
    [stopTimer],
  );

  /** Dev: manual call `__daDebugTransportSync({ ... })` or toggle `window.__DA_DEBUG_TRANSPORT__ = true`. */
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const w = window as unknown as {
      __daDebugTransportSync?: typeof debugTransportSyncTruth;
    };
    w.__daDebugTransportSync = debugTransportSyncTruth;
    return () => {
      delete w.__daDebugTransportSync;
    };
  }, []);

  // loopBars no longer drives metronome audio (lookahead is transport-phase only).

  /**
   * MET off → stop lookahead. MET turned **on** while already playing/recording → start (e.g. user toggles mid-take).
   * Do **not** call `startMetronomeLoop` on every `transport` change: `play()` / `record()` → `startTimer()` already
   * starts the metronome; restarting here immediately after re-seeds `nextTick` / bumps `runId` and can phase-warp
   * or strand the worker so clicks die after ~one bar.
   */
  const metronomeEnabledPrevRef = useRef(metronomeEnabled);
  useEffect(() => {
    const prevOn = metronomeEnabledPrevRef.current;
    const on = metronomeEnabled;
    metronomeEnabledPrevRef.current = on;

    if (!on) {
      stopMetronomeLoop();
      return;
    }
    const t = transportRef.current;
    if (
      !prevOn &&
      on &&
      isRunningRef.current &&
      (t === 'playing' || t === 'recording')
    ) {
      startMetronomeLoop(bpmRef.current);
    }
    /* Intentionally omit `transport` from deps — we only react to MET toggles. Re-running on every
     * transport flip was redundant and could stack duplicate `startMetronomeLoop` with `startTimer`. */
  }, [metronomeEnabled, startMetronomeLoop, stopMetronomeLoop]);

  /** Start/stop MIDI clock lookahead when toggled during playback. */
  useEffect(() => {
    if (!midiClockEnabled) {
      stopMidiClockLoop();
      return;
    }
    if (
      isRunningRef.current &&
      (transportRef.current === 'playing' ||
        transportRef.current === 'recording') &&
      midiOutputRef.current
    ) {
      sendMidiSongPositionPointer(tickCounterRef.current || 0);
      sendMidiRealtimeRef.current(0xfa);
      startMidiClockLoop();
    }
  }, [midiClockEnabled, startMidiClockLoop, stopMidiClockLoop, sendMidiSongPositionPointer]);

  // ── Derived display values ──────────────────────────────────────────────
  // Beat-within-bar sub-step still uses integer display ticks; wrapped quarter index uses `floor(displayBeats)` in the RAF loop.
  const displayTickUi = wrapGlobalTickToDisplayTick(
    Math.max(0, Math.floor(displayState.positionTicks)),
  );
  const currentBeat = displayState.currentBeatInBar;

  const currentSubstep = Math.min(
    3,
    Math.floor(((displayTickUi % PPQ) * 4) / PPQ),
  );

  const songBeat = currentBeat;

  const loopSection = loopProfiles[activeLoopModule]?.section ?? null;

  const loopState = useMemo(
    () => loopStateFromParts(loopEnabled, loopStartBar, loopBars, loopSection),
    [loopEnabled, loopStartBar, loopBars, loopSection],
  );

  const subscribeTransportBeatUi = useCallback((onStoreChange: () => void) => {
    beatUiListenersRef.current.add(onStoreChange);
    return () => {
      beatUiListenersRef.current.delete(onStoreChange);
    };
  }, []);

  const getTransportBeatUiSnapshot = useCallback(
    () => beatUiSnapshotRef.current,
    [],
  );

  const getTransportAudioBpm = useCallback(
    () => Math.max(1, bpmRef.current),
    [],
  );

  // Expose transport on window so all modules can sync
  useEffect(() => {
    (window as any).__daMusicTransport = {
      start: play,
      stop,
      getBeat: () => currentBeatInBarRef.current,
    };
    return () => {
      delete (window as any).__daMusicTransport;
    };
  }, [play, stop, currentBeat]);

  // ── Provider ────────────────────────────────────────────────────────────
  return (
    <MasterClockContext.Provider
      value={{
        ppq: PPQ,
        sampleRate,
        bpm: bpmState,
        getTransportAudioBpm,
        setBpm,
        transport,
        tempoMap,
        timeSigs,
        setTempoMap,
        setTimeSigs,
        addTempoEvent,
        addTimeSigEvent,
        play,
        pause,
        stop,
        record,
        playMetronomeClickAt,
        seekToTick,
        positionTicks: displayState.positionTicks,
        transportBeatFloat: displayState.transportBeatFloat,
        transportBeatFloatRef,
        transportBeatIndexRef,
        currentBeatInBarRef,
        transportBeatIndex: displayState.songStep,
        transportUnwrappedQuarterIndex: displayState.transportUnwrappedQuarterIndex,
        transportUnwrappedQuarterIndexRef,
        subscribeTransportBeatUi,
        getTransportBeatUiSnapshot,
        currentStep: displayState.currentStep,
        currentBar: displayState.currentBar,
        currentTick: displayState.currentTick,
        currentMeasure: displayState.currentMeasure,
        totalBars,
        currentBeat,
        currentSubstep,
        songBar: displayState.songBar,
        songStep: displayState.songStep,
        songBeat,
        transportTimelineEpoch,
        playheadFrac: displayState.playheadFrac,
        songPlayheadFrac: displayState.songPlayheadFrac,
        loopEnabled,
        setLoopEnabled,
        loopBars,
        setLoopBars,
        setLoopRange,
        setLoopGeometry,
        clearLoop,
        loopSection,
        loopState,
        activeLoopModule,
        setActiveLoopModule,
        loopStartBar,
        setLoopStartBar,
        loopEndBar,
        loopStartTick,
        loopEndTick,
        ticksPerBar,
        quartersPerBar,
        beatsInBar,
        songTotalBars,
        setSongTotalBars,
        punchEnabled,
        setPunchEnabled,
        punchInTick,
        setPunchInTick,
        punchOutTick,
        setPunchOutTick,
        quantize,
        setQuantize,
        quantizeTicks,
        quantizeStrength,
        setQuantizeStrength,
        snapEnabled,
        setSnapEnabled,
        snapTick: snapTickLocal,
        syncDrums,
        setSyncDrums,
        syncPiano,
        setSyncPiano,
        syncArr,
        setSyncArr,
        syncMix,
        setSyncMix,
        metronomeEnabled,
        setMetronomeEnabled,
        metronomeClickLatencyMs,
        setMetronomeClickLatencyMs,
        syncMetronomeClickLatencyFromOutput,
        countInEnabled,
        setCountInEnabled,
        countInBeats,
        setCountInBeats,
        countDownTicks,
        midiClockEnabled,
        setMidiClockEnabled,
        sendMidiClock,
        patternMode,
        setPatternMode,
        channelLevels,
        channelVolumes,
        triggerChannel,
        setChannelVolume,
        ticksToSeconds: ticksToSecondsLocal,
        secondsToTicks: secondsToTicksLocal,
        tickToBarBeat: tickToBarBeatLocal,
        exportSession,
        masterOutputLinear,
        setMasterOutputLinear,
        getOrCreateAudioContext,
        getTickIntAtAudioNow,
        tickCounterRef,
        mapGlobalTickToAudioTime,
        wrapGlobalTickToDisplayTick,
        getDisplayBeatsAtAudioNow,
        getTransportBeatFloatGridLockedAtAudioNow,
        getStudioTimelineBeatFloatGridLockedAtAudioNow,
        getStudioGridQuarterIndexAtAudioNow,
        getGlobalBeatsUnwrappedAtAudioNow,
        masterMeterAnalyserRef,
        audioCtxRef,
        secondsPerStepRef,
        loopStepsRef,
        playStartTimeRef,
      }}
    >
      {children}
    </MasterClockContext.Provider>
  );
}

export function useMasterClock() {
  const ctx = useContext(MasterClockContext);
  if (!ctx)
    throw new Error(
      'useMasterClock must be used within MasterClockProvider',
    );
  return ctx;
}
