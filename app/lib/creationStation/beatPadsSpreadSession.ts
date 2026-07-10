/**
 * Beat Pads Spread track — session-only (tab). Pads are never overwritten;
 * spread lives on CH 17 with its own piano roll.
 */

import type { BeatPadsSpreadDirection } from '@/app/lib/creationStation/beatPadsHitSpread';
import type {
  BeatPadsSpreadLoopBars,
  BeatPadsSpreadNote,
  BeatPadsSpreadTrackState,
} from '@/app/lib/creationStation/beatPadsSpreadTrack';
import type { BeatPadsGridStepsPerBar } from '@/app/lib/creationStation/beatLabDrumMachineSequencer';
import type { StoredPadSample } from '@/app/lib/padSampleStorage';

const SESSION_KEY = 'creationStation_beatPadsSpread_v2';

export type BeatPadsSpreadSession = {
  version: 2;
  bank: number;
  sourcePad: number;
  direction: BeatPadsSpreadDirection;
  rootMidi: number;
  baseLabel: string;
  loopBars: BeatPadsSpreadLoopBars;
  stepsPerBar: BeatPadsGridStepsPerBar;
  mixerChannel: number;
  keyLockEnabled?: boolean;
  harmonyLane?: number;
  notes: BeatPadsSpreadNote[];
  sample: StoredPadSample;
};

export function beatPadsSpreadSessionFromTrack(
  track: BeatPadsSpreadTrackState,
): BeatPadsSpreadSession {
  return {
    version: 2,
    bank: track.bank,
    sourcePad: track.sourcePad,
    direction: track.direction,
    rootMidi: track.rootMidi,
    baseLabel: track.baseLabel,
    loopBars: track.loopBars,
    stepsPerBar: track.stepsPerBar,
    mixerChannel: track.mixerChannel,
    keyLockEnabled: track.keyLockEnabled ?? false,
    harmonyLane: track.harmonyLane,
    notes: track.notes,
    sample: track.sample,
  };
}

export function readBeatPadsSpreadSession(): BeatPadsSpreadSession | null {
  if (typeof sessionStorage === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as BeatPadsSpreadSession;
    if (parsed.version !== 2) return null;
    if (typeof parsed.bank !== 'number' || typeof parsed.sample !== 'object') return null;
    if (!Array.isArray(parsed.notes)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeBeatPadsSpreadSession(session: BeatPadsSpreadSession | null): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    if (!session) {
      sessionStorage.removeItem(SESSION_KEY);
      sessionStorage.removeItem('creationStation_beatPadsSpread_v1');
      return;
    }
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    /* quota — memory-only still works this session */
  }
}
