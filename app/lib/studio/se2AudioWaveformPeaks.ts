/**
 * Decimated peak envelope for timeline audio clips (Pro Tools / Studio One style).
 * Peaks are cached per `sourceId` so grid repaints stay cheap.
 */

const PEAK_CACHE_MAX_BUCKETS = 16384;

type PeakCacheEntry = { sampleLen: number; peaks: number[] };

const peakCache = new Map<string, PeakCacheEntry>();

/** Stereo-aware peak buckets normalized 0–1 (max bucket = 1). */
export function computeSe2AudioWaveformPeaks(buf: AudioBuffer, bucketCount: number): number[] {
  const buckets = Math.max(8, Math.min(PEAK_CACHE_MAX_BUCKETS, Math.floor(bucketCount)));
  const channels = Math.min(buf.numberOfChannels, 2);
  const len = buf.length;
  if (len <= 0) return Array.from({ length: buckets }, () => 0);

  const step = len / buckets;
  const raw: number[] = new Array(buckets);
  for (let i = 0; i < buckets; i++) {
    let max = 0;
    const j0 = Math.floor(i * step);
    const j1 = Math.min(len, Math.floor((i + 1) * step));
    for (let c = 0; c < channels; c++) {
      const ch = buf.getChannelData(c);
      for (let j = j0; j < j1; j++) {
        const v = Math.abs(ch[j]!);
        if (v > max) max = v;
      }
    }
    raw[i] = max;
  }
  const mx = Math.max(0.001, ...raw);
  return raw.map((p) => Math.min(1, p / mx));
}

export function getSe2AudioWaveformPeaks(sourceId: string, buf: AudioBuffer): number[] {
  const cached = peakCache.get(sourceId);
  if (cached && cached.sampleLen === buf.length) return cached.peaks;
  const peaks = computeSe2AudioWaveformPeaks(buf, PEAK_CACHE_MAX_BUCKETS);
  peakCache.set(sourceId, { sampleLen: buf.length, peaks });
  return peaks;
}

export function invalidateSe2AudioWaveformPeaks(sourceId: string): void {
  peakCache.delete(sourceId);
}

export function se2AudioBuffersSignature(
  buffers: ReadonlyMap<string, AudioBuffer> | null | undefined,
): string {
  if (!buffers || buffers.size === 0) return '';
  return [...buffers.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, buf]) => `${id}:${buf.length}:${buf.duration.toFixed(4)}`)
    .join(';');
}

/** Mirrored waveform inside a clip rect (clipped to rounded rect when supported). */
export function drawSe2ClipWaveform(
  ctx: CanvasRenderingContext2D,
  peaks: number[],
  x: number,
  y: number,
  w: number,
  h: number,
  radius = 2,
): void {
  if (w < 2 || h < 4 || peaks.length === 0) return;

  ctx.save();
  if (typeof ctx.roundRect === 'function') {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, radius);
    ctx.clip();
  } else {
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
  }

  const midY = y + h * 0.5;
  const maxHalf = h * 0.49;
  const step = peaks.length / w;

  for (let px = 0; px < w; px++) {
    const i0 = Math.floor(px * step);
    const i1 = Math.min(peaks.length - 1, Math.floor((px + 1) * step));
    let peak = 0;
    for (let i = i0; i <= i1; i++) peak = Math.max(peak, peaks[i] ?? 0);
    const half = Math.max(0.5, peak * maxHalf);
    ctx.fillStyle = `rgba(255,255,255,${0.3 + peak * 0.58})`;
    ctx.fillRect(x + px, midY - half, 1, half);
    ctx.fillStyle = `rgba(255,255,255,${0.18 + peak * 0.42})`;
    ctx.fillRect(x + px, midY, 1, half);
  }

  ctx.restore();
}
