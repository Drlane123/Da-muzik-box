/**
 * Legato performance script — hammer-ons, pull-offs, slides from overlap + velocity.
 * Port 1:1 to JUCE `GuitarLegatoScript` in processBlock.
 */
import type { GuitarLegatoKind, GuitarLegatoState } from '@/app/lib/studio/guitarEngine/types';

export type GuitarLegatoEvent = {
  midi: number;
  velocity127: number;
  whenSec: number;
  kind: GuitarLegatoKind;
  /** Scale gain for legato retrigger (no full pick attack). */
  attackGain: number;
  skipStrokeNoise: boolean;
};

export type GuitarLegatoScriptOpts = {
  /** Max gap (sec) still treated as legato after note-off. */
  maxGapSec?: number;
  /** Min overlap (sec) for hammer-on detection. */
  minOverlapSec?: number;
  /** Velocity delta threshold for pull-off (lower 2nd note). */
  pullOffVelocityDelta?: number;
};

const DEFAULT_OPTS: Required<GuitarLegatoScriptOpts> = {
  maxGapSec: 0.09,
  minOverlapSec: 0.018,
  pullOffVelocityDelta: 18,
};

export function createGuitarLegatoState(): GuitarLegatoState {
  return {
    lastMidi: null,
    lastOnsetSec: 0,
    lastReleaseSec: 0,
    overlapSec: 0,
    lastVelocity: 0,
  };
}

/**
 * Call on each note-on before sample selection.
 * Returns performance kind + gain scaling for the playback engine.
 */
export function guitarLegatoScriptNoteOn(
  state: GuitarLegatoState,
  midi: number,
  velocity127: number,
  whenSec: number,
  opts?: GuitarLegatoScriptOpts,
): GuitarLegatoEvent {
  const o = { ...DEFAULT_OPTS, ...opts };
  const prevMidi = state.lastMidi;
  const gap = whenSec - state.lastReleaseSec;
  const overlap = whenSec - state.lastOnsetSec;
  const stillRinging = gap < 0 || overlap > o.minOverlapSec;

  let kind: GuitarLegatoKind = 'attack';
  let attackGain = 1;
  let skipStrokeNoise = false;

  if (prevMidi != null && stillRinging) {
    const interval = midi - prevMidi;
    const velDrop = state.lastVelocity - velocity127;

    if (interval > 0 && velocity127 >= 40) {
      kind = 'hammer_on';
      attackGain = 0.42 + (velocity127 / 127) * 0.35;
      skipStrokeNoise = true;
    } else if (interval < 0 && velDrop >= o.pullOffVelocityDelta) {
      kind = 'pull_off';
      attackGain = 0.32 + (velocity127 / 127) * 0.28;
      skipStrokeNoise = true;
    } else if (Math.abs(interval) <= 2) {
      kind = 'slide';
      attackGain = 0.55;
      skipStrokeNoise = true;
    } else {
      kind = 'legato' as GuitarLegatoKind;
      attackGain = 0.48;
      skipStrokeNoise = true;
    }
  }

  state.lastMidi = midi;
  state.lastOnsetSec = whenSec;
  state.lastVelocity = velocity127;
  state.overlapSec = stillRinging ? overlap : 0;

  return {
    midi,
    velocity127,
    whenSec,
    kind,
    attackGain,
    skipStrokeNoise,
  };
}

export function guitarLegatoScriptNoteOff(
  state: GuitarLegatoState,
  whenSec: number,
): void {
  state.lastReleaseSec = whenSec;
}
