/**
 * SE2 808 Lab — 1-bar snare / clap step pattern (repeats every bar for any loop length).
 */
export const SE2_LAB808_PERC_STEPS_PER_BAR = 16;

export type Se2Lab808PercLane = 'snare' | 'clap';

export type Se2Lab808PercPattern = {
  snare: boolean[];
  clap: boolean[];
};

export function emptySe2Lab808PercBar(): boolean[] {
  return Array.from({ length: SE2_LAB808_PERC_STEPS_PER_BAR }, () => false);
}

export function emptySe2Lab808PercPattern(): Se2Lab808PercPattern {
  return { snare: emptySe2Lab808PercBar(), clap: emptySe2Lab808PercBar() };
}

/** Classic backbeat — steps 5 & 13 (1-based) = indices 4 & 12 (beats 2 & 4). */
export function se2Lab808PercTwoAndFourPattern(): Se2Lab808PercPattern {
  const snare = emptySe2Lab808PercBar();
  const clap = emptySe2Lab808PercBar();
  snare[4] = true;
  snare[12] = true;
  return { snare, clap };
}

/** Single hit on step 9 (1-based) = index 8 (beat 3). */
export function se2Lab808PercStepNineBar(): boolean[] {
  const bar = emptySe2Lab808PercBar();
  bar[8] = true;
  return bar;
}

export function se2Lab808PercStepNinePattern(): Se2Lab808PercPattern {
  const bar = se2Lab808PercStepNineBar();
  return { snare: [...bar], clap: [...bar] };
}

export function normalizeSe2Lab808PercBar(raw: readonly boolean[] | undefined): boolean[] {
  const out = emptySe2Lab808PercBar();
  if (!raw) return out;
  for (let i = 0; i < SE2_LAB808_PERC_STEPS_PER_BAR; i++) {
    out[i] = !!raw[i];
  }
  return out;
}

export function normalizeSe2Lab808PercPattern(
  snare?: readonly boolean[],
  clap?: readonly boolean[],
): Se2Lab808PercPattern {
  return {
    snare: normalizeSe2Lab808PercBar(snare),
    clap: normalizeSe2Lab808PercBar(clap),
  };
}

export function se2Lab808PercHasHits(pattern: Se2Lab808PercPattern): boolean {
  return pattern.snare.some(Boolean) || pattern.clap.some(Boolean);
}

export function se2Lab808PercToggleStep(
  pattern: Se2Lab808PercPattern,
  lane: Se2Lab808PercLane,
  step: number,
): Se2Lab808PercPattern {
  const i = Math.max(0, Math.min(SE2_LAB808_PERC_STEPS_PER_BAR - 1, Math.floor(step)));
  const next = {
    snare: [...pattern.snare],
    clap: [...pattern.clap],
  };
  if (lane === 'snare') next.snare[i] = !next.snare[i];
  else next.clap[i] = !next.clap[i];
  return next;
}
