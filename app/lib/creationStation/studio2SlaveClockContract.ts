export type Studio2TransportSnapshotSec = {
  running: boolean;
  bpm: number;
  /** Continuous beat in quarter-note units (SE2 grid). */
  beatFloat: number;
  /** Integer quarter index (floor(beatFloat)). */
  quarterIndex: number;
  /** Seconds on the master's AudioContext timeline for this snapshot. */
  contextTimeSec: number;
  sampleRate: number;
  outputLatencySec?: number;
  /** Optional SE2 grid params (if the publisher exposes them). */
  beatsPerBar?: number;
  loopOn?: boolean;
  loopStartBeat?: number;
  loopEndBeat?: number;
};

export type Studio2SlaveClockPhaseCallback = (
  deltaSamples: number,
  info: { contextTimeSec: number; sampleRate: number; phase128: number },
) => void;

export type Studio2SlaveClock = {
  getAudioContext(): AudioContext | null;
  getTransportSnapshotAtTime(contextTimeSec: number): Studio2TransportSnapshotSec;
  subscribeMasterTick(cb: Studio2SlaveClockPhaseCallback): () => void;
};

declare global {
  interface Window {
    __daMusicStudio2SlaveClock?: Studio2SlaveClock | undefined;
  }
}

export const STUDIO2_SLAVE_PHASE_SAMPLES = 128;

export function readStudio2SlaveClock(): Studio2SlaveClock | undefined {
  if (typeof window === 'undefined') return undefined;
  return window.__daMusicStudio2SlaveClock;
}

