/**
 * DAW Core Type Definitions
 * Canonical types for the DAW engine — PPQ, transport, MIDI, tracks.
 */

// ── Fundamental constants ──────────────────────────────────────────────────────

export type PPQType       = 480 | 960 | 1920;

export type SampleRate    = 44100 | 48000 | 88200 | 96000;

export type MIDIValue     = number; // 0–127, must be clamped before use

export type TimeSigDenominator = 2 | 4 | 8 | 16;


// ── Helper: clamp a number to MIDI range ─────────────────────────────────────

export function clampMIDI(v: number): MIDIValue {
  return Math.max(0, Math.min(127, Math.round(v)));
}


// ── Transport ─────────────────────────────────────────────────────────────────

export interface Transport {
  positionTicks: number;
  isPlaying:     boolean;
  playbackRate:  number;
  loop: {
    enabled:   boolean;
    startTick: number;
    endTick:   number;
  };
  punch?: {
    enabled: boolean;
    inTick:  number;
    outTick: number;
  };
  metronome?: boolean;
}


// ── Tempo & time signature ────────────────────────────────────────────────────

export interface TempoEvent {
  tick:   number;
  bpm:    number;
  curve?: number; // 0 = step (default), 1 = linear ramp
}


export interface TimeSignature {
  tick:        number;
  numerator:   number;
  denominator: TimeSigDenominator;
}


// ── MIDI Note ─────────────────────────────────────────────────────────────────

export interface MIDINote {
  id:       string;
  pitch:    MIDIValue;   // 0–127
  start:    number;      // ticks
  length:   number;      // ticks, minimum 1
  velocity: MIDIValue;   // 0–127
  muted?:   boolean;
  legato?:  boolean;
  releaseVelocity?: MIDIValue; // optional, default 64
  channel?: number;            // 1–16
}


// ── Automation ────────────────────────────────────────────────────────────────

export interface AutomationEvent {
  tick:  number;
  value: MIDIValue; // 0–127
}


// automation is keyed by CC number (0–127)

export type AutomationMap = Map<number, AutomationEvent[]>;


// ── Track ─────────────────────────────────────────────────────────────────────

export interface Track {
  id:          string;
  name:        string;
  notes:       MIDINote[];
  automation:  AutomationMap;
  midiChannel: number; // 1–16
  muted?:      boolean;
  solo?:       boolean;
}


// ── Project config ────────────────────────────────────────────────────────────

export interface ProjectConfig {
  ppq:        PPQType;
  sampleRate: SampleRate;
  bufferSize: 64 | 128 | 256 | 512;
  version:    string;
}


// ── Full session (matches DAWCoreTimeModel JSON schema) ───────────────────────

export interface DAWSession {
  projectConfig: ProjectConfig;
  transport:     Transport;
  tempoMap:      TempoEvent[];
  timeSignatures: TimeSignature[];
  tracks:        Track[];
}


// ── Quantize grid ─────────────────────────────────────────────────────────────

export type QuantizeGrid = '1/1' | '1/2' | '1/4' | '1/8' | '1/16' | '1/32' | '1/8T' | '1/16T';


/** Returns grid size in ticks for a given PPQ */

export function quantizeGridToTicks(grid: QuantizeGrid, ppq: PPQType): number {
  switch (grid) {
    case '1/1':   return ppq * 4;
    case '1/2':   return ppq * 2;
    case '1/4':   return ppq;
    case '1/8':   return ppq / 2;
    case '1/16':  return ppq / 4;
    case '1/32':  return ppq / 8;
    case '1/8T':  return Math.round(ppq * 2 / 3);
    case '1/16T': return Math.round(ppq / 3);
  }
}

/** Nearest tick on quantize grid (full snap — combine with strength via `snapToGrid` if needed). */
export function quantizeTickToNearestGrid(
  tick: number,
  grid: QuantizeGrid,
  ppq: PPQType = 960,
): number {
  const step = quantizeGridToTicks(grid, ppq);
  return Math.round(tick / step) * step;
}


/** Snap tick to nearest grid point with optional strength (0–1) */

export function snapToGrid(tick: number, gridTicks: number, strength = 1): number {
  const nearest = Math.round(tick / gridTicks) * gridTicks;
  return Math.round(tick + (nearest - tick) * strength);
}


/** Quantize a note's start with swing offset.
 *  swingPercent: 0–100 (50 = straight, >50 pushes even 8ths late)
 */
export function applySwing(tick: number, gridTicks: number, swingPercent: number): number {
  const beat = Math.floor(tick / gridTicks);
  const isOffBeat = beat % 2 === 1;
  if (!isOffBeat) return tick;
  const offset = Math.round(gridTicks * ((swingPercent - 50) / 100));
  return tick + offset;
}


// ── Tempo map math ────────────────────────────────────────────────────────────

/** ticks → seconds using step tempo map */

export function ticksToSeconds(ticks: number, tempoMap: TempoEvent[], ppq: PPQType = 960): number {
  if (!tempoMap.length) return ticks / ppq * (60 / 120);
  let seconds  = 0;
  let prevTick = 0;
  let prevBpm  = tempoMap[0].bpm;

  for (let i = 0; i < tempoMap.length; i++) {
    const ev      = tempoMap[i];
    const nextEv  = tempoMap[i + 1];
    prevBpm       = ev.bpm;
    const segEnd  = nextEv ? Math.min(ticks, nextEv.tick) : ticks;
    const segStart = Math.max(prevTick, ev.tick);
    if (segEnd > segStart) seconds += (segEnd - segStart) / ppq * (60 / prevBpm);
    prevTick = ev.tick;
    if (!nextEv || ticks <= nextEv.tick) break;
  }
  return seconds;
}


/** seconds → ticks using step tempo map */

export function secondsToTicks(seconds: number, tempoMap: TempoEvent[], ppq: PPQType = 960): number {
  if (!tempoMap.length) return Math.round(seconds * ppq * (120 / 60));
  let remaining = seconds;
  let ticks     = 0;

  for (let i = 0; i < tempoMap.length; i++) {
    const ev   = tempoMap[i];
    const next = tempoMap[i + 1];
    const bpm  = ev.bpm;
    if (next) {
      const segSecs = (next.tick - ev.tick) / ppq * (60 / bpm);
      if (remaining <= segSecs) {
        return ev.tick + Math.round(remaining * ppq * (bpm / 60));
      }
      remaining -= segSecs;
      ticks = next.tick;
    } else {
      return ticks + Math.round(remaining * ppq * (bpm / 60));
    }
  }
  return ticks;
}


/** tick → { bar, beat, tickInBeat } given time sig and PPQ */

export function tickToBarBeat(
  tick: number,
  timeSigs: TimeSignature[],
  ppq: PPQType = 960
): { bar: number; beat: number; tickInBeat: number } {
  const sig         = timeSigs[0] ?? { tick: 0, numerator: 4, denominator: 4 as TimeSigDenominator };
  const ticksPerBeat = ppq * (4 / sig.denominator);
  const ticksPerBar  = ticksPerBeat * sig.numerator;
  const bar         = Math.floor(tick / ticksPerBar) + 1;
  const rem         = tick % ticksPerBar;
  const beat        = Math.floor(rem / ticksPerBeat) + 1;
  const tickInBeat  = rem % ticksPerBeat;
  return { bar, beat, tickInBeat };
}

/**
 * Same grid as {@link tickToBarBeat}, but accepts a fractional tick so bar/beat UI can follow
 * continuous audio-time (`originTick + elapsed*bpm` PPQ) without `Math.round` skipping quarter steps.
 */
export function tickToBarBeatFromFloatTick(
  tick: number,
  timeSigs: TimeSignature[],
  ppq: PPQType = 960
): { bar: number; beat: number; tickInBeat: number } {
  const sig =
    timeSigs[0] ?? { tick: 0, numerator: 4, denominator: 4 as TimeSigDenominator };
  const ticksPerBeat = ppq * (4 / sig.denominator);
  const ticksPerBar = ticksPerBeat * sig.numerator;
  const bar = Math.floor(tick / ticksPerBar) + 1;
  const rem = tick - (bar - 1) * ticksPerBar;
  const beat = Math.min(
    sig.numerator,
    Math.max(1, Math.floor(rem / ticksPerBeat) + 1),
  );
  const tickInBeat = rem - (beat - 1) * ticksPerBeat;
  return { bar, beat, tickInBeat };
}


/** BPM at a specific tick */

export function bpmAtTick(tick: number, tempoMap: TempoEvent[]): number {
  let bpm = tempoMap[0]?.bpm ?? 120;
  for (const ev of tempoMap) {
    if (ev.tick <= tick) bpm = ev.bpm;
    else break;
  }
  return bpm;
}


/** Ensure noteOff >= noteOn + minLength */

export function clampNoteLength(note: MIDINote, minLength = 1): MIDINote {
  return { ...note, length: Math.max(minLength, note.length) };
}


// ── DAWEngine class ───────────────────────────────────────────────────────────

/**
 * DAWEngine — stateful DAW calculation engine.
 * Wraps a DAWSession and provides sample-accurate conversion,
 * quantization, and note utilities.
 */
export class DAWEngine {
  private state: {
    ppq:        PPQType;
    sampleRate: SampleRate;
    tempoMap:   TempoEvent[];
    transport:  Transport;
  };

  constructor(initialState: {
    ppq?:        PPQType;
    sampleRate?: SampleRate;
    tempoMap?:   TempoEvent[];
    transport?:  Partial<Transport>;
  } = {}) {
    this.state = {
      ppq:        initialState.ppq        ?? 960,
      sampleRate: initialState.sampleRate ?? 48000,
      tempoMap:   initialState.tempoMap   ?? [{ tick: 0, bpm: 120 }],
      transport: {
        positionTicks: 0,
        isPlaying:     false,
        playbackRate:  1.0,
        loop:          { enabled: false, startTick: 0, endTick: 960 * 4 * 4 },
        ...initialState.transport,
      },
    };
  }

  // ── Getters / setters ────────────────────────────────────────────────────
  get ppq():        PPQType   { return this.state.ppq; }
  get sampleRate(): SampleRate { return this.state.sampleRate; }
  get tempoMap():   TempoEvent[] { return this.state.tempoMap; }
  get transport():  Transport  { return this.state.transport; }

  setTempoMap(map: TempoEvent[]): void {
    this.state.tempoMap = [...map].sort((a, b) => a.tick - b.tick);
  }

  addTempoEvent(ev: TempoEvent): void {
    const filtered = this.state.tempoMap.filter(e => e.tick !== ev.tick);
    this.state.tempoMap = [...filtered, ev].sort((a, b) => a.tick - b.tick);
  }

  setBpm(bpm: number, atTick = 0): void {
    this.addTempoEvent({ tick: atTick, bpm: Math.max(1, Math.min(999, bpm)) });
  }

  // ── Core conversion: ticks → seconds ─────────────────────────────────────
  /**
   * Converts an absolute tick position to wall-clock seconds
   * using the current tempo map (handles multi-BPM segments).
   */
  public ticksToSeconds(ticks: number): number {
    const map = this.state.tempoMap;
    const ppq = this.state.ppq;
    let totalSeconds = 0;
    let lastTick     = 0;

    for (let i = 0; i < map.length; i++) {
      const ev   = map[i];
      const next = map[i + 1];

      if (ticks <= ev.tick) break;

      const segStart = Math.max(lastTick, ev.tick);
      const segEnd   = next ? Math.min(ticks, next.tick) : ticks;
      if (segEnd > segStart) {
        totalSeconds += ((segEnd - segStart) / ppq) * (60 / ev.bpm);
      }
      lastTick = ev.tick;
    }

    // Remaining ticks after last tempo marker
    const lastEvent = map[map.length - 1];
    if (ticks > Math.max(lastEvent?.tick ?? 0, lastTick)) {
      const segStart = Math.max(lastEvent?.tick ?? 0, lastTick);
      totalSeconds += ((ticks - segStart) / ppq) * (60 / (lastEvent?.bpm ?? 120));
    }

    return totalSeconds;
  }

  /** Converts seconds to ticks using the tempo map. */
  public secondsToTicks(seconds: number): number {
    return secondsToTicks(seconds, this.state.tempoMap, this.state.ppq);
  }

  /** Converts ticks to sample offset (for sample-accurate scheduling). */
  public ticksToSamples(ticks: number): number {
    return Math.round(this.ticksToSeconds(ticks) * this.state.sampleRate);
  }

  /** Sample offset → ticks. */
  public samplesToTicks(samples: number): number {
    return this.secondsToTicks(samples / this.state.sampleRate);
  }

  // ── Quantization ──────────────────────────────────────────────────────────
  /**
   * Returns a quantized tick for the given subdivision (note value denominator)
   * and optional strength (0–1, default = 1 full snap).
   * @param subdivision  4 = quarter, 8 = eighth, 16 = sixteenth, etc.
   */
  public getQuantizedTick(tick: number, subdivision: number, strength = 1.0): number {
    const gridTicks = this.state.ppq * (4 / subdivision);
    const nearest   = Math.round(tick / gridTicks) * gridTicks;
    return Math.round(tick + (nearest - tick) * Math.max(0, Math.min(1, strength)));
  }

  /**
   * Quantize using a QuantizeGrid string (e.g. '1/16', '1/8T').
   */
  public quantize(tick: number, grid: QuantizeGrid, strength = 1.0): number {
    const gridTicks = quantizeGridToTicks(grid, this.state.ppq);
    const nearest   = Math.round(tick / gridTicks) * gridTicks;
    return Math.round(tick + (nearest - tick) * Math.max(0, Math.min(1, strength)));
  }

  // ── Note helpers ──────────────────────────────────────────────────────────
  /** Clamp note velocity and pitch to valid MIDI range. */
  public validateNote(note: MIDINote): MIDINote {
    return {
      ...note,
      pitch:    clampMIDI(note.pitch),
      velocity: clampMIDI(note.velocity),
      releaseVelocity: note.releaseVelocity !== undefined ? clampMIDI(note.releaseVelocity) : 64,
      length:   Math.max(1, note.length),
    };
  }

  /** Ensures noteOff (start + length) >= start + minLength. */
  public clampNoteLength(note: MIDINote, minLength = 1): MIDINote {
    return clampNoteLength(note, minLength);
  }

  /** BPM at a given tick position. */
  public bpmAt(tick: number): number {
    return bpmAtTick(tick, this.state.tempoMap);
  }

  /** Tick → { bar, beat, tickInBeat } */
  public tickPosition(tick: number, timeSigs: TimeSignature[] = [{ tick: 0, numerator: 4, denominator: 4 }]): { bar: number; beat: number; tickInBeat: number } {
    return tickToBarBeat(tick, timeSigs, this.state.ppq);
  }

  // ── Session snapshot ──────────────────────────────────────────────────────
  /** Export current engine state as a DAWSession. */
  public toSession(tracks: Track[] = [], timeSignatures: TimeSignature[] = [{ tick: 0, numerator: 4, denominator: 4 }]): DAWSession {
    return {
      projectConfig: {
        ppq:        this.state.ppq,
        sampleRate: this.state.sampleRate,
        bufferSize: 128,
        version:    '1.0.0',
      },
      transport:      this.state.transport,
      tempoMap:       this.state.tempoMap,
      timeSignatures,
      tracks,
    };
  }

  /** Create a DAWEngine from a DAWSession. */
  static fromSession(session: DAWSession): DAWEngine {
    return new DAWEngine({
      ppq:        session.projectConfig.ppq,
      sampleRate: session.projectConfig.sampleRate,
      tempoMap:   session.tempoMap,
      transport:  session.transport,
    });
  }
}


/** Create a default empty session */

export function createDefaultSession(ppq: PPQType = 960, bpm = 120): DAWSession {
  return {
    projectConfig: { ppq, sampleRate: 48000, bufferSize: 128, version: '1.0.0' },
    transport: {
      positionTicks: 0,
      isPlaying:     false,
      playbackRate:  1.0,
      loop:          { enabled: true, startTick: 0, endTick: ppq * 4 * 4 },
      punch:         { enabled: false, inTick: 0, outTick: ppq * 16 },
      metronome:     false,
    },
    tempoMap:       [{ tick: 0, bpm }],
    timeSignatures: [{ tick: 0, numerator: 4, denominator: 4 }],
    tracks:         [],
  };
}
