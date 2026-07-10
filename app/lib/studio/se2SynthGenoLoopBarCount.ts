/** Musical loop lengths only — 4, 8, or 12 bars (no odd counts like 5 or 9). */
export type GenoLoopBarCount = 4 | 8 | 12;

export const GENO_LOOP_BAR_COUNTS: readonly GenoLoopBarCount[] = [4, 8, 12];

export function genoCoerceLoopBarCount(n: number | null | undefined): GenoLoopBarCount {
  if (n === 4) return 4;
  if (n === 12) return 12;
  return 8;
}

export function genoIsLoopBarCount(n: number): n is GenoLoopBarCount {
  return n === 4 || n === 8 || n === 12;
}
