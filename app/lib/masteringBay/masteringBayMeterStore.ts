/**
 * Live meter bus for Mastering Bay — rAF publishes here so VU / analyzer
 * can update without re-rendering the rack + source track every frame.
 */
import {
  idleMultiMeterSnap,
  idleNugenMeterSnap,
  type MultiMeterSnap,
  type NugenMeterSnap,
} from '@/app/lib/masteringBay/masteringBayMeterIdle';
import {
  IDLE_PROCESS_LIVE,
  processLiveFromMeters,
  type ProcessLiveFeed,
} from '@/app/lib/masteringBay/masteringBayProcessLive';

let multiSnap: MultiMeterSnap = idleMultiMeterSnap();
let nugenSnap: NugenMeterSnap = idleNugenMeterSnap();
let processLive: ProcessLiveFeed = IDLE_PROCESS_LIVE;
let version = 0;
const listeners = new Set<() => void>();

export function publishMasteringBayMeterSnaps(
  multi: MultiMeterSnap,
  nugen: NugenMeterSnap,
): void {
  multiSnap = multi;
  nugenSnap = nugen;
  processLive = processLiveFromMeters(nugen, multi);
  version += 1;
  listeners.forEach((fn) => fn());
}

export function resetMasteringBayMeterStore(): void {
  multiSnap = idleMultiMeterSnap();
  nugenSnap = idleNugenMeterSnap();
  processLive = IDLE_PROCESS_LIVE;
  version += 1;
  listeners.forEach((fn) => fn());
}

export function getMasteringBayMultiSnap(): MultiMeterSnap {
  return multiSnap;
}

export function getMasteringBayNugenSnap(): NugenMeterSnap {
  return nugenSnap;
}

export function getMasteringBayProcessLive(): ProcessLiveFeed {
  return processLive;
}

export function getMasteringBayMeterVersion(): number {
  return version;
}

export function subscribeMasteringBayMeters(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
  };
}
