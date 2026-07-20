/**
 * SE2 per-clip event gain (Cubase / Studio One style) — non-destructive dB offset.
 * Waveform height and preview playback both scale from this value.
 */

export const SE2_CLIP_GAIN_DB_MIN = -24;
export const SE2_CLIP_GAIN_DB_MAX = 24;
export const SE2_CLIP_GAIN_DB_DEFAULT = 0;
/** Mastering Bay–matched feel for vertical drag on the clip. */
export const SE2_CLIP_GAIN_DB_PER_PX = 0.2;
/** Baseline linear gain used by SE2 preview bus before clip gainDb. */
export const SE2_CLIP_PREVIEW_BASE_GAIN = 0.42;

export function clampSe2ClipGainDb(db: number): number {
  if (!Number.isFinite(db)) return SE2_CLIP_GAIN_DB_DEFAULT;
  return Math.max(SE2_CLIP_GAIN_DB_MIN, Math.min(SE2_CLIP_GAIN_DB_MAX, db));
}

export function se2ClipGainDbToLin(db: number): number {
  const g = clampSe2ClipGainDb(db);
  return 10 ** (g / 20);
}

/** Visual amplitude scale — capped so the wave stays inside the clip rect. */
export function se2ClipGainAmplitudeScale(gainDb: number | undefined): number {
  return Math.min(1.85, se2ClipGainDbToLin(gainDb ?? SE2_CLIP_GAIN_DB_DEFAULT));
}

export function se2ClipPreviewGainLin(gainDb: number | undefined): number {
  return SE2_CLIP_PREVIEW_BASE_GAIN * se2ClipGainDbToLin(gainDb ?? SE2_CLIP_GAIN_DB_DEFAULT);
}

export function formatSe2ClipGainDb(db: number): string {
  const g = clampSe2ClipGainDb(db);
  if (Math.abs(g) < 0.05) return '0 dB';
  const sign = g > 0 ? '+' : '';
  return `${sign}${g.toFixed(1)} dB`;
}
