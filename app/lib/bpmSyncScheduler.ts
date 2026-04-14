// Drum lookahead: times from `mapGlobalTickToAudioTime(integer tick)` only — no `+= sec/beat` drift.

const PPQ = 960;

export interface SchedulerConfig {
  bpm: number;
  lookaheadMs: number;
  scheduleAheadSeconds: number;
  totalSteps?: number;
  loopEnabled?: boolean;
  loopStartBar?: number;
  loopBars?: number;
  /** Quarter-note steps per bar — must match MasterClock `ticksPerBar / ppq`. */
  quartersPerBar?: number;
  /** Canonical name (either this or `getTickIntAtAudioNow` required). */
  getTickIntAtAudioTime?: (audioTime: number) => number;
  /** Alias matching MasterClock export — Creation Station passes this. */
  getTickIntAtAudioNow?: (audioTime: number) => number;
  mapGlobalTickToAudioTime: (globalTick: number) => number;
  wrapGlobalTickToDisplayTick: (globalTickInt: number) => number;
}

export class BPMSyncScheduler {
  private audioContext: AudioContext;
  private bpm: number;
  private lookaheadMs: number;
  private scheduleAheadSeconds: number;
  /** Authoritative next hit: global quarter-note tick (multiple of PPQ). */
  private nextGlobalQuarterTick: number = 0;
  private nextNoteTime: number = 0;
  private currentStepIndex: number = 0;
  private totalSteps: number;
  private loopEnabled: boolean;
  private loopStartBar: number;
  private loopBars: number;
  private quartersPerBar: number;
  private getTickIntAtAudioTime: (audioTime: number) => number;
  private mapGlobalTickToAudioTime: (globalTick: number) => number;
  private wrapGlobalTickToDisplayTick: (globalTickInt: number) => number;
  private schedulerTimerId: ReturnType<typeof setTimeout> | null = null;
  private isRunning: boolean = false;
  private onScheduleNote: ((beatNumber: number, time: number) => void) | null =
    null;

  constructor(audioContext: AudioContext, config: SchedulerConfig) {
    this.audioContext = audioContext;
    this.bpm = config.bpm;
    this.lookaheadMs = config.lookaheadMs || 25;
    this.scheduleAheadSeconds = config.scheduleAheadSeconds || 0.1;
    this.totalSteps = config.totalSteps || 16;
    this.loopEnabled = config.loopEnabled ?? false;
    this.loopStartBar = Math.max(1, config.loopStartBar ?? 1);
    this.loopBars = Math.max(1, config.loopBars ?? 4);
    this.quartersPerBar = Math.max(1, config.quartersPerBar ?? 4);
    const tickFn =
      config.getTickIntAtAudioTime ?? config.getTickIntAtAudioNow;
    if (typeof tickFn !== 'function') {
      throw new Error(
        'BPMSyncScheduler: pass getTickIntAtAudioTime or getTickIntAtAudioNow',
      );
    }
    this.getTickIntAtAudioTime = tickFn;
    this.mapGlobalTickToAudioTime = config.mapGlobalTickToAudioTime;
    this.wrapGlobalTickToDisplayTick = config.wrapGlobalTickToDisplayTick;
  }

  onNote(callback: (beatNumber: number, time: number) => void) {
    this.onScheduleNote = callback;
    return this;
  }

  setBPM(bpm: number) {
    this.bpm = bpm;
  }

  setMasterTimeFns(
    getTickIntAtAudioTime: (audioTime: number) => number,
    mapGlobalTickToAudioTime: (globalTick: number) => number,
    wrapGlobalTickToDisplayTick: (globalTickInt: number) => number,
  ) {
    this.getTickIntAtAudioTime = getTickIntAtAudioTime;
    this.mapGlobalTickToAudioTime = mapGlobalTickToAudioTime;
    this.wrapGlobalTickToDisplayTick = wrapGlobalTickToDisplayTick;
  }

  setLoopState(
    loopEnabled: boolean,
    loopStartBar: number,
    loopBars: number,
    quartersPerBar?: number,
  ) {
    this.loopEnabled = loopEnabled;
    this.loopStartBar = Math.max(1, loopStartBar);
    this.loopBars = Math.max(1, loopBars);
    if (quartersPerBar !== undefined) {
      this.quartersPerBar = Math.max(1, quartersPerBar);
    }
  }

  private drumStepFromTransportBeat(transportBeat: number): number {
    const steps = Math.max(1, this.totalSteps);
    const loopStartBeat = (this.loopStartBar - 1) * this.quartersPerBar;
    if (this.loopEnabled) {
      const rel = transportBeat - loopStartBeat;
      return ((rel % steps) + steps) % steps;
    }
    return ((transportBeat % steps) + steps) % steps;
  }

  private alignFromTransport(): {
    nextTime: number;
    stepIndex: number;
    nextQuarterTick: number;
  } {
    const ctx = this.audioContext;
    const tickNow = this.getTickIntAtAudioTime(ctx.currentTime);
    const beatFloat = tickNow / PPQ;
    let nextBeat = Math.ceil(beatFloat - 1e-9);
    let nextBeatTick = nextBeat * PPQ;
    let nextTime = this.mapGlobalTickToAudioTime(nextBeatTick);
    let guard = 0;
    while (nextTime < ctx.currentTime && guard++ < 64) {
      nextBeat += 1;
      nextBeatTick += PPQ;
      nextTime = this.mapGlobalTickToAudioTime(nextBeatTick);
    }
    const displayTick = this.wrapGlobalTickToDisplayTick(nextBeatTick);
    const transportBeat = Math.floor(displayTick / PPQ);
    const stepIndex = this.drumStepFromTransportBeat(transportBeat);
    return { nextTime, stepIndex, nextQuarterTick: nextBeatTick };
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    const aligned = this.alignFromTransport();
    this.nextGlobalQuarterTick = aligned.nextQuarterTick;
    this.nextNoteTime = aligned.nextTime;
    this.currentStepIndex = aligned.stepIndex;
    this.scheduleNotes();
  }

  stop() {
    this.isRunning = false;
    if (this.schedulerTimerId !== null) {
      clearTimeout(this.schedulerTimerId);
      this.schedulerTimerId = null;
    }
  }

  private scheduleNotes() {
    if (!this.isRunning) return;
    const ctx = this.audioContext;
    const scheduleUntil = ctx.currentTime + this.scheduleAheadSeconds;

    const aligned = this.alignFromTransport();
    const tOurs = this.mapGlobalTickToAudioTime(this.nextGlobalQuarterTick);
    if (Math.abs(tOurs - aligned.nextTime) > 0.03) {
      this.nextGlobalQuarterTick = aligned.nextQuarterTick;
      this.nextNoteTime = aligned.nextTime;
      this.currentStepIndex = aligned.stepIndex;
    }

    while (true) {
      const tick = this.nextGlobalQuarterTick;
      const t = this.mapGlobalTickToAudioTime(tick);
      if (t >= scheduleUntil) break;
      const displayTick = this.wrapGlobalTickToDisplayTick(tick);
      const transportBeat = Math.floor(displayTick / PPQ);
      const stepIndex = this.drumStepFromTransportBeat(transportBeat);
      this.currentStepIndex = stepIndex;
      if (this.onScheduleNote) {
        this.onScheduleNote(stepIndex, t);
      }
      this.nextGlobalQuarterTick = tick + PPQ;
    }

    this.nextNoteTime = this.mapGlobalTickToAudioTime(
      this.nextGlobalQuarterTick,
    );

    if (this.isRunning) {
      this.schedulerTimerId = setTimeout(
        () => this.scheduleNotes(),
        this.lookaheadMs,
      );
    }
  }

  getCurrentBeat(): number {
    return this.currentStepIndex;
  }

  getCurrentTime(): number {
    return this.audioContext.currentTime;
  }

  reset(beat: number = 0) {
    this.currentStepIndex = beat;
    this.nextNoteTime = this.audioContext.currentTime;
  }
}
