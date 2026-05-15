/** Grid snap divisions per 4/4 bar (straight + triplet 1/12). */
export type Lab808Quantize = '1/4' | '1/8' | '1/12' | '1/16' | '1/32' | '1/64';

export const LAB808_QUANTIZE_OPTIONS: readonly Lab808Quantize[] = [
  '1/4',
  '1/8',
  '1/12',
  '1/16',
  '1/32',
  '1/64',
] as const;

export function quantizeDivisionsPerBar(q: Lab808Quantize): number {
  switch (q) {
    case '1/4':
      return 4;
    case '1/8':
      return 8;
    case '1/12':
      return 12;
    case '1/16':
      return 16;
    case '1/32':
      return 32;
    case '1/64':
      return 64;
  }
}

export function quantizeStepBeats(q: Lab808Quantize, beatsPerBar = 4): number {
  return beatsPerBar / quantizeDivisionsPerBar(q);
}

export function snapBeatToQuantize(beat: number, q: Lab808Quantize, beatsPerBar = 4): number {
  const step = quantizeStepBeats(q, beatsPerBar);
  if (step <= 0) return beat;
  return Math.round(beat / step) * step;
}

export function snapDurationBeats(
  durBeats: number,
  q: Lab808Quantize,
  opts?: { beatsPerBar?: number; minSteps?: number; maxBeats?: number },
): number {
  const beatsPerBar = opts?.beatsPerBar ?? 4;
  const step = quantizeStepBeats(q, beatsPerBar);
  const minSteps = opts?.minSteps ?? 1;
  const maxBeats = opts?.maxBeats ?? 16;
  const snapped = Math.max(minSteps * step, Math.round(durBeats / step) * step);
  return Math.min(maxBeats, snapped);
}

/** Beat positions for vertical grid lines (0 … maxBeat inclusive). */
export function quantizeGridBeats(maxBeat: number, q: Lab808Quantize, beatsPerBar = 4): number[] {
  const step = quantizeStepBeats(q, beatsPerBar);
  const out: number[] = [];
  if (step <= 0) return [0];
  const limit = maxBeat + step * 0.5;
  for (let b = 0; b <= limit; b += step) {
    out.push(Math.round(b * 1e6) / 1e6);
  }
  return out;
}

export function isQuantizeBarLine(beat: number, beatsPerBar = 4): boolean {
  return beat % beatsPerBar < 1e-9;
}

export function isQuantizeBeatLine(beat: number): boolean {
  return Math.abs(beat - Math.round(beat)) < 1e-9;
}
