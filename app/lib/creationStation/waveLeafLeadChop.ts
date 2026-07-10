/**
 * Groove Lead — BPM-synced rhythmic chop (transport gate on the lead channel bus).
 * Long lead notes stay in tune; gain opens/closes on the grid like a step sequencer.
 */
import { CREATION_SCHEDULE_AHEAD_SEC } from '@/app/lib/creationStation/creationTransportSystem';
import { grooveLabChannelChopGate } from '@/app/lib/creationStation/grooveLabAudio';
import {
  isGrooveLabQuantize,
  type GrooveLabQuantize,
} from '@/app/lib/creationStation/grooveLabRoll';
import { SE2_AUDIO_START_FLOOR_SEC } from '@/app/lib/studio/se2TransportClock';
import { waveLeafQuantizeStepSec } from '@/app/lib/creationStation/waveLeafPreviewPhrase';

const STORAGE_KEY = 'wave-leaf-lead-chop-enabled';
const STORAGE_QUANT_KEY = 'wave-leaf-lead-chop-quantize';

/** 16-step syncopated gate — one bar at 1/16, repeats cleanly. */
const PRETTY_CHOP_PATTERN_16: readonly number[] = [
  1, 0, 1, 0, 0, 1, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0,
];

const CHOP_DUTY = 0.4;
const CHOP_ATTACK_SEC = 0.002;
const CHOP_RELEASE_SEC = 0.004;

let runtimeEnabled = false;
let runtimeQuantize: GrooveLabQuantize = '1/16';

export function readWaveLeafLeadChopEnabledFromStorage(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function readWaveLeafLeadChopQuantizeFromStorage(
  fallback: GrooveLabQuantize = '1/16',
): GrooveLabQuantize {
  if (typeof window === 'undefined') return fallback;
  try {
    const v = window.localStorage.getItem(STORAGE_QUANT_KEY);
    if (v && isGrooveLabQuantize(v)) return v;
  } catch {
    /* */
  }
  return fallback;
}

export function writeWaveLeafLeadChopRuntime(enabled: boolean, quantize?: GrooveLabQuantize): void {
  runtimeEnabled = enabled;
  if (quantize) runtimeQuantize = quantize;
}

export function readWaveLeafLeadChopEnabled(): boolean {
  return runtimeEnabled;
}

export function readWaveLeafLeadChopQuantize(): GrooveLabQuantize {
  return runtimeQuantize;
}

export function bypassWaveLeafLeadChopGate(ctx: AudioContext, melodyChannel: number): void {
  const gate = grooveLabChannelChopGate(ctx, melodyChannel);
  if (!gate) return;
  const t = ctx.currentTime;
  try {
    gate.gain.cancelScheduledValues(t);
    gate.gain.setValueAtTime(1, t);
  } catch {
    /* closed ctx */
  }
}

export type RefillWaveLeafLeadChopOpts = {
  sessionStart: number;
  bpm: number;
  melodyChannel: number;
  quantize?: GrooveLabQuantize;
  loopContinuation?: boolean;
};

/** Schedule rhythmic chop on the lead channel gate (call from transport lookahead pump). */
export function refillWaveLeafLeadChop(
  ctx: AudioContext,
  ctSnap: number,
  nextStepRef: { current: number },
  opts: RefillWaveLeafLeadChopOpts,
): void {
  const gate = grooveLabChannelChopGate(ctx, opts.melodyChannel);
  if (!gate) return;

  const tNow = ctx.currentTime;
  try {
    gate.gain.cancelScheduledValues(tNow);
    gate.gain.setValueAtTime(1, tNow);
  } catch {
    return;
  }

  if (!readWaveLeafLeadChopEnabled()) {
    return;
  }
  if (opts.sessionStart <= 0) return;

  const quantize = opts.quantize ?? readWaveLeafLeadChopQuantize();
  const stepSec = waveLeafQuantizeStepSec(opts.bpm, quantize);
  if (stepSec <= 0) return;

  const horizon = ctSnap + CREATION_SCHEDULE_AHEAD_SEC;
  const chainFloor = opts.loopContinuation ? 0.004 : SE2_AUDIO_START_FLOOR_SEC;
  let chain = ctSnap + chainFloor;

  let stepIdx = nextStepRef.current;
  let tStep = opts.sessionStart + stepIdx * stepSec;
  while (tStep < ctSnap - stepSec * 0.5) {
    stepIdx += 1;
    tStep = opts.sessionStart + stepIdx * stepSec;
  }

  let n = 0;
  while (tStep < horizon && n < 384) {
    const open = PRETTY_CHOP_PATTERN_16[stepIdx % PRETTY_CHOP_PATTERN_16.length] === 1;
    const t0 = Math.max(tStep, chain);
    try {
      if (open) {
        const tOpen = t0 + CHOP_ATTACK_SEC;
        const tHoldEnd = t0 + stepSec * CHOP_DUTY;
        const tClose = tHoldEnd + CHOP_RELEASE_SEC;
        gate.gain.setValueAtTime(0, t0);
        gate.gain.linearRampToValueAtTime(1, tOpen);
        gate.gain.setValueAtTime(1, tHoldEnd);
        gate.gain.linearRampToValueAtTime(0, tClose);
      } else {
        gate.gain.setValueAtTime(0, t0);
      }
    } catch {
      break;
    }
    chain = t0 + stepSec * 0.02;
    stepIdx += 1;
    tStep = opts.sessionStart + stepIdx * stepSec;
    n += 1;
  }
  nextStepRef.current = stepIdx;
}

export function resetWaveLeafLeadChopScheduler(nextStepRef: { current: number }): void {
  nextStepRef.current = 0;
}
