/**
 * Sequencer PUMPER — quantized sidechain-style duck on the arp bus.
 * Grid reference: 32nd notes within a bar (16 steps × 2 sub-hits).
 */
import { genoArpStepInBar } from '@/app/lib/studio/genoUltraArpPattern';

export const GENO_ARP_PUMPER_RATE_LABELS = ['1/32', '1/16', '1/8', '1/4', '1/2'] as const;
export type GenoArpPumperRateIdx = 0 | 1 | 2 | 3 | 4;

/** Pump cycle length in 32nd-note units (1/32 … 1/2). */
const PUMPER_CYCLE_32ND = [1, 2, 4, 8, 16] as const;

export function genoArpSanitizePumperRateIdx(n: number): GenoArpPumperRateIdx {
  const v = Math.round(n);
  if (v <= 0) return 0;
  if (v >= 4) return 4;
  return v as GenoArpPumperRateIdx;
}

export function genoArpPumperCycle32nd(rateIdx: number): number {
  return PUMPER_CYCLE_32ND[genoArpSanitizePumperRateIdx(rateIdx)] ?? 4;
}

/** Phase within the bar on a 32nd grid (0–31). */
export function genoArpPumperPhase32nd(stepInBar: number, subHit = 0): number {
  const step = ((stepInBar % 16) + 16) % 16;
  return step * 2 + (subHit & 1);
}

/** 1 = pump up (full level), 0 = ducked. */
export function genoArpPumperOpenAt(stepInBar: number, rateIdx: number, subHit = 0): number {
  const phase = genoArpPumperPhase32nd(stepInBar, subHit);
  const cycle = genoArpPumperCycle32nd(rateIdx);
  return phase % cycle === 0 ? 1 : 0;
}

export function genoArpPumperBusGain(
  open: number,
  depth: number,
  baseGain = 0.88,
): number {
  const d = Math.max(0, Math.min(1, depth));
  return open >= 0.5 ? baseGain : baseGain * (1 - d);
}

/** LOW knob — highpass cutoff (0 = open, 1 = cuts bass). */
export function genoArpPumperLowCutHz(amount: number): number {
  const t = Math.max(0, Math.min(1, amount));
  if (t <= 0.001) return 20;
  return 20 * (1200 / 20) ** t;
}

/** HIGH knob — lowpass cutoff (0 = open, 1 = cuts treble). */
export function genoArpPumperHighCutHz(amount: number): number {
  const t = Math.max(0, Math.min(1, amount));
  if (t <= 0.001) return 20000;
  return 20000 * (500 / 20000) ** t;
}

export function applyGenoArpPumperBusFilters(
  hpf: BiquadFilterNode,
  lpf: BiquadFilterNode,
  highKnob: number,
  lowKnob: number,
): void {
  hpf.type = 'highpass';
  hpf.frequency.value = genoArpPumperLowCutHz(lowKnob);
  hpf.Q.value = 0.707;
  lpf.type = 'lowpass';
  lpf.frequency.value = genoArpPumperHighCutHz(highKnob);
  lpf.Q.value = 0.707;
}

/** Schedule arp-bus gain duck / release for one quantized pump edge. */
export function scheduleGenoArpPumperBusGain(
  ctx: AudioContext,
  bus: GainNode,
  when: number,
  gridCol: number,
  rateIdx: number,
  depth: number,
  attackMs: number,
  releaseMs: number,
  subHit = 0,
  baseGain = 0.88,
): void {
  const stepInBar = genoArpStepInBar(gridCol);
  const open = genoArpPumperOpenAt(stepInBar, rateIdx, subHit);
  const target = genoArpPumperBusGain(open, depth, baseGain);
  const rampSec = Math.max(
    0.001,
    (open >= 0.5 ? attackMs : releaseMs) / 1000,
  );
  const t = Math.max(ctx.currentTime, when);
  const g = bus.gain;
  g.cancelScheduledValues(t);
  g.setValueAtTime(g.value, t);
  g.linearRampToValueAtTime(target, t + rampSec);
}
