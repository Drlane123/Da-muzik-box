/**
 * Tone.js Transport-Based Scheduler
 * Replaces setInterval/setTimeout with sample-accurate scheduling
 * Fixes tempo drift by using hardware audio clock as single source of truth
 */

import * as Tone from 'tone';


export interface ToneSchedulerConfig {
  bpm: number;
  onMetronomeBeat?: (beatNumber: number) => void;
  onNoteStart?: (note: any) => void;
  onNoteEnd?: (note: any) => void;
}


class ToneTransportScheduler {
  private transport: any;
  private metronomeLoop: Tone.Loop | null = null;
  private midiParts: Map<string, Tone.Part<any>> = new Map();
  private metronomeEnabled = false;
  private config: ToneSchedulerConfig;

  constructor(config: ToneSchedulerConfig) {
    this.config = config;
    this.transport = Tone.getTransport();
    this.setupTransport();
  }

  /**
   * Initialize the Transport as the master clock
   */
  private setupTransport() {
    this.transport.bpm.value = this.config.bpm;
    this.transport.timeSignature = [4, 4];
  }

  /**
   * Start audio context and transport
   */
  async start() {
    await Tone.start();
    this.transport.start();
  }

  /**
   * Stop transport
   */
  stop() {
    this.transport.stop();
    this.transport.cancel();
  }

  /**
   * Pause without stopping
   */
  pause() {
    this.transport.pause();
  }

  /**
   * Resume from pause
   */
  resume() {
    this.transport.start();
  }

  /**
   * Set BPM with smooth ramp (prevents note interruption)
   */
  setBpm(newBpm: number) {
    this.transport.bpm.rampTo(newBpm, 0.1);
    this.config.bpm = newBpm;
  }

  /**
   * Get current BPM
   */
  getBpm(): number {
    return this.transport.bpm.value;
  }

  /**
   * Setup metronome using Tone.Loop for sample-accurate timing
   * CRITICAL: This synth runs at audio rate (no drift possible)
   */
  setupMetronome() {
    if (this.metronomeLoop) {
      this.metronomeLoop.dispose();
    }

    // Create dedicated metronome synth for zero latency
    const metronome = new Tone.Synth({
      oscillator: { type: 'square' },
      envelope: { attack: 0.001, decay: 0.1, sustain: 0, release: 0.1 }
    }).toDestination();

    // Schedule metronome beat on every quarter note
    this.metronomeLoop = new Tone.Loop((time) => {
      // CRITICAL: Pass the 'time' argument so it plays at exact sample-accurate moment
      metronome.triggerAttackRelease('C6', '32n', time, 0.2);
      this.config.onMetronomeBeat?.(this.transport.PPQ);
    }, '4n'); // Repeat every quarter note

    this.metronomeLoop.start(0);
    this.metronomeEnabled = true;
  }

  /**
   * Schedule MIDI notes using Tone.Part
   * This is the correct way to handle piano roll data
   */
  scheduleMidiNotes(noteData: Array<any>, partName: string = 'default') {
    
    // Remove old part if exists
    const oldPart = this.midiParts.get(partName);
    if (oldPart) {
      oldPart.dispose();
    }

    // Create synth for this part
    const synth = new Tone.Synth({
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.005, decay: 0.1, sustain: 0.3, release: 0.5 }
    }).toDestination();

    // Create Tone.Part for MIDI scheduling
    const part = new Tone.Part((time: number, value: any) => {
      // CRITICAL: Pass 'time' to ensure sample-accurate scheduling
      const velocity = value.velocity ?? 100;
      synth.triggerAttackRelease(value.note, value.duration, time, velocity / 127);
      this.config.onNoteStart?.(value);
    }, noteData);

    part.start(0);
    this.midiParts.set(partName, part);
  }

  /**
   * Update existing MIDI notes without stopping playback
   */
  updateMidiNotes(noteData: Array<any>, partName: string = 'default') {
    const part = this.midiParts.get(partName);
    if (part) {
      part.dispose();
    }
    this.scheduleMidiNotes(noteData, partName);
  }

  /**
   * Set playback position
   */
  setPosition(transportTime: string) {
    this.transport.position = transportTime;
  }

  /**
   * Get current playback position
   */
  getPosition(): string {
    return this.transport.position as string;
  }

  /**
   * Get current time in seconds (for UI updates)
   */
  getCurrentTime(): number {
    return this.transport.seconds;
  }

  /**
   * Calculate time in milliseconds for a given number of bars
   */
  barsToDuration(bars: number): number {
    const quarterNoteTime = (60 / this.transport.bpm.value) * 1000;
    return bars * 4 * quarterNoteTime;
  }

  /**
   * Enable/disable metronome
   */
  toggleMetronome(enabled: boolean) {
    if (enabled && !this.metronomeEnabled) {
      this.setupMetronome();
    } else if (!enabled && this.metronomeEnabled && this.metronomeLoop) {
      this.metronomeLoop.stop();
      this.metronomeEnabled = false;
    }
  }

  /**
   * Clean up all resources
   */
  dispose() {
    if (this.metronomeLoop) {
      this.metronomeLoop.dispose();
    }
    this.midiParts.forEach(part => part.dispose());
    this.midiParts.clear();
  }
}


// Singleton instance

let schedulerInstance: ToneTransportScheduler | null = null;


export function getToneScheduler(config?: ToneSchedulerConfig): ToneTransportScheduler {
  if (!schedulerInstance && config) {
    schedulerInstance = new ToneTransportScheduler(config);
  }
  return schedulerInstance!;
}


export function initializeToneScheduler(config: ToneSchedulerConfig): ToneTransportScheduler {
  schedulerInstance = new ToneTransportScheduler(config);
  return schedulerInstance;
}


export function disposeToneScheduler() {
  if (schedulerInstance) {
    schedulerInstance.dispose();
    schedulerInstance = null;
  }
}
