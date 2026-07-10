/**
 * Per-track pad sample persistence for SE2 Beat Pads lanes.
 * Keys: `${trackId}_${padIndex}`.
 */
import type { PadSampleStore } from '@/app/lib/padSampleStorage';

export const SE2_BEAT_PADS_PAD_SAMPLES_STORAGE_KEY = 'se2_beatPads_padSamples_v1';

export function se2BeatPadsPadKey(trackId: string, padIndex: number): string {
  return `${trackId}_${padIndex}`;
}

export function loadSe2BeatPadsPadStore(): PadSampleStore {
  try {
    const raw = localStorage.getItem(SE2_BEAT_PADS_PAD_SAMPLES_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as PadSampleStore;
  } catch {
    return {};
  }
}

export function saveSe2BeatPadsPadStore(store: PadSampleStore): void {
  try {
    localStorage.setItem(SE2_BEAT_PADS_PAD_SAMPLES_STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* quota */
  }
}
