/**
 * Retrologue-style analog gate — per-step lane + pump depth / attack / release.
 */
import { genoArpStepInBar } from '@/app/lib/studio/genoUltraArpPattern';

export type GenoArpAnalogGateShape = {
  skipNote: boolean;
  velocityMul: number;
  holdSecMul: number;
  attackSec: number;
  releaseSec: number;
};

/** Blank GATE lane (all 0) = fully open until the user draws a pump pattern. */
export function genoArpGateLaneIsBlank(levels: readonly number[]): boolean {
  for (let i = 0; i < levels.length; i += 1) {
    if ((levels[i] ?? 0) > 0.001) return false;
  }
  return true;
}

export function genoArpGateLaneOpenAt(
  levels: readonly number[],
  step: number,
  blank = genoArpGateLaneIsBlank(levels),
): number {
  const v = levels[step] ?? 0;
  if (blank || v <= 0.001) return 1;
  return Math.max(0, Math.min(1, v));
}

/**
 * Gate FX on + blank lane → default 1/8 pump on the 16th grid.
 * User-drawn GATE lane overrides when any step is non-zero.
 */
export function resolveArpGateLaneOpen(
  gateFxOn: boolean,
  gridCol: number,
  gateLaneBlank: boolean,
  gateRaw: number,
): number {
  if (!gateFxOn) return 1;
  if (!gateLaneBlank && gateRaw > 0.001) {
    return Math.max(0, Math.min(1, gateRaw));
  }
  const inBar = genoArpStepInBar(gridCol);
  return inBar % 2 === 0 ? 1 : 0;
}

export function genoArpAnalogGateShape(opts: {
  fxOn: boolean;
  laneOpen: number;
  depth: number;
  attackMs: number;
  releaseMs: number;
  stepSec: number;
}): GenoArpAnalogGateShape {
  if (!opts.fxOn) {
    return {
      skipNote: false,
      velocityMul: 1,
      holdSecMul: 1,
      attackSec: -1,
      releaseSec: -1,
    };
  }

  const open = Math.max(0, Math.min(1, opts.laneOpen));
  const depth = Math.max(0, Math.min(1, opts.depth));

  if (open < 0.02) {
    return {
      skipNote: true,
      velocityMul: 0,
      holdSecMul: 0,
      attackSec: 0.001,
      releaseSec: 0.004,
    };
  }

  const closed = 1 - open;
  const chop = depth * closed;

  return {
    skipNote: false,
    velocityMul: Math.max(0.04, 1 - chop * 0.98),
    holdSecMul: Math.max(0.04, 1 - chop * 0.96),
    attackSec: Math.max(0.001, opts.attackMs / 1000),
    releaseSec: Math.max(
      0.003,
      Math.min(opts.releaseMs / 1000, Math.max(0.01, opts.stepSec * 0.88)),
    ),
  };
}
