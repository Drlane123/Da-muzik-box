/**
 * Registry of active live vocal-FX chains (one entry per playing clip segment).
 */
import type { StudioTrackVocalFx } from '@/app/lib/studio/studioTrackVocalFx';

export type StudioLiveVocalFxRuntimeHandle = {
  cleanup: () => void;
  updateTrackFx: (fx: StudioTrackVocalFx, keyRoot: number) => void;
};

type RegistryEntry = {
  trackIndex: number;
  handle: StudioLiveVocalFxRuntimeHandle;
};

const entries: RegistryEntry[] = [];

export function registerStudioLiveVocalFx(
  trackIndex: number,
  handle: StudioLiveVocalFxRuntimeHandle,
): () => void {
  const entry: RegistryEntry = { trackIndex, handle };
  entries.push(entry);
  return () => {
    const ix = entries.indexOf(entry);
    if (ix >= 0) entries.splice(ix, 1);
  };
}

/** Only toggling FX on/off requires a new graph — all faders/presets/MIDI routes update live. */
export function studioVocalFxNeedsLiveReconnect(
  prev: StudioTrackVocalFx,
  next: StudioTrackVocalFx,
): boolean {
  return prev.autotuneOn !== next.autotuneOn || prev.vocoderOn !== next.vocoderOn;
}

/**
 * Push fader updates to active live chains on a track.
 * Returns false when nothing was updated (caller should reschedule playback).
 */
export function updateStudioLiveVocalFxForTrack(
  trackIndex: number,
  fx: StudioTrackVocalFx,
  keyRoot: number,
  needsReconnect: boolean,
): boolean {
  const active = entries.filter((e) => e.trackIndex === trackIndex);
  if (active.length === 0) return false;
  if (needsReconnect) {
    for (const { handle } of active) handle.cleanup();
    return false;
  }
  for (const { handle } of active) handle.updateTrackFx(fx, keyRoot);
  return true;
}

export function cleanupAllStudioLiveVocalFx(): void {
  for (const { handle } of [...entries]) handle.cleanup();
  entries.length = 0;
}

/** Drop registry rows without running cleanup (after insert invalidate already tore down the graph). */
export function purgeStudioLiveVocalFxRegistryForTrack(trackIndex: number): void {
  for (let i = entries.length - 1; i >= 0; i -= 1) {
    if (entries[i]!.trackIndex === trackIndex) entries.splice(i, 1);
  }
}

/** After a track delete — purge that index and shift higher registry indices down. */
export function reindexStudioLiveVocalFxRegistryAfterRemove(trackIndex: number): void {
  for (let i = entries.length - 1; i >= 0; i -= 1) {
    const e = entries[i]!;
    if (e.trackIndex === trackIndex) {
      e.handle.cleanup();
      entries.splice(i, 1);
    } else if (e.trackIndex > trackIndex) {
      e.trackIndex -= 1;
    }
  }
}
