/**
 * Studio Editor 2 mixer meters — fast attack, instant release peak ballistics.
 *
 * Attack ~10 ms so hits register cleanly; release tracks the live peak immediately
 * so strips drop to zero as soon as the channel goes silent.
 */

export type StudioMixerMeterDisplay = {
  l: number;
  r: number;
};

export const STUDIO_MIXER_MASTER_TRACK_INDEX = -1;

/** Hard zero below ~−72 dBFS. */
export const STUDIO_MIXER_SILENCE_LINEAR = 0.00025;

/** Ignore analyser noise floor — real hits only (~−66 dBFS). */
export const STUDIO_MIXER_NOISE_GATE_LINEAR = 0.0005;

const METER_FLOOR_DB = -60;
const METER_CEIL_DB = 0;
const METER_ATTACK_SEC = 0.01;

type ChannelState = { l: number; r: number };
const stripStates = new Map<number, ChannelState>();

export function studioMixerLevelToDisplay(linear: number): number {
  if (!Number.isFinite(linear) || linear <= STUDIO_MIXER_SILENCE_LINEAR) return 0;
  const db = 20 * Math.log10(linear);
  if (db <= METER_FLOOR_DB) return 0;
  return Math.max(0, Math.min(1, (db - METER_FLOOR_DB) / (METER_CEIL_DB - METER_FLOOR_DB)));
}

export function studioMixerDisplayToDb(displayNorm: number): number {
  if (!Number.isFinite(displayNorm) || displayNorm <= 0) return METER_FLOOR_DB;
  return METER_FLOOR_DB + Math.min(1, displayNorm) * (METER_CEIL_DB - METER_FLOOR_DB);
}

export function studioMixerChannelMeterLinear(postFaderLinear: number): number {
  const v = postFaderLinear;
  if (!Number.isFinite(v) || v <= STUDIO_MIXER_NOISE_GATE_LINEAR) return 0;
  return Math.min(1, v);
}

export function studioMixerMonitorLinear(
  postFaderLinear: number,
  masterMonitorLinear: number,
): number {
  const v = postFaderLinear * Math.max(0, masterMonitorLinear);
  if (!Number.isFinite(v) || v <= STUDIO_MIXER_NOISE_GATE_LINEAR) return 0;
  return Math.min(1, v);
}

/** Gate + clamp sample peak — no hysteresis (prevents idle strip flicker). */
export function studioMixerMeterTargetLinear(
  peak: number,
  rms: number,
  _trackKey = -2,
): number {
  const p = Math.max(0, peak, rms * 1.2);
  if (p <= STUDIO_MIXER_NOISE_GATE_LINEAR) return 0;
  return Math.min(1, p);
}

export function studioMixerBufferPeak(samples: Float32Array): number {
  let peak = 0;
  for (let i = 0; i < samples.length; i++) {
    const a = Math.abs(samples[i] ?? 0);
    if (a > peak) peak = a;
  }
  return peak;
}

export function studioMixerBufferRms(samples: Float32Array): number {
  let sumSq = 0;
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i] ?? 0;
    sumSq += s * s;
  }
  return Math.sqrt(sumSq / Math.max(1, samples.length));
}

export function studioMixerBufferIsSilent(samples: Float32Array): boolean {
  return studioMixerBufferPeak(samples) < STUDIO_MIXER_NOISE_GATE_LINEAR;
}

/** Fast attack (~10 ms); instant release so meters track silence immediately. */
function stepBallisticsLinear(current: number, target: number, dtSec: number): number {
  const targetClamped = Math.max(0, Math.min(1, target));
  if (targetClamped <= STUDIO_MIXER_NOISE_GATE_LINEAR) return 0;
  if (targetClamped <= current) return targetClamped;
  return targetClamped + (current - targetClamped) * Math.exp(-dtSec / METER_ATTACK_SEC);
}

export function studioMixerMeterBallisticsStep(
  trackIndex: number,
  rawL: number,
  rawR: number,
  dtSec: number,
): StudioMixerMeterDisplay {
  const prev = stripStates.get(trackIndex) ?? { l: 0, r: 0 };
  const dt = Math.max(1 / 240, Math.min(0.05, dtSec));
  const linL = stepBallisticsLinear(prev.l, rawL, dt);
  const linR = stepBallisticsLinear(prev.r, rawR, dt);
  stripStates.set(trackIndex, { l: linL, r: linR });
  return {
    l: studioMixerLevelToDisplay(linL),
    r: studioMixerLevelToDisplay(linR),
  };
}

let lastFrameMs = 0;

export function studioMixerMeterFrameDt(): number {
  const now = performance.now();
  const dt = lastFrameMs > 0 ? (now - lastFrameMs) / 1000 : 1 / 60;
  lastFrameMs = now;
  return Math.max(1 / 240, Math.min(0.05, dt));
}

export function resetStudioMixerMeterBallistics(): void {
  stripStates.clear();
  lastFrameMs = 0;
}
