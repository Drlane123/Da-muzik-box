'use client';

import { useSyncExternalStore } from 'react';
import {
  getMasteringBayMeterVersion,
  getMasteringBayMultiSnap,
  getMasteringBayNugenSnap,
  getMasteringBayProcessLive,
  subscribeMasteringBayMeters,
} from '@/app/lib/masteringBay/masteringBayMeterStore';
import type { MultiMeterSnap, NugenMeterSnap } from '@/app/lib/masteringBay/masteringBayMeterIdle';
import type { ProcessLiveFeed } from '@/app/lib/masteringBay/masteringBayProcessLive';

/** Subscribe to Mastering Bay meter bus — only re-renders meter UI, not the whole bay. */
export function useMasteringBayMultiSnap(): MultiMeterSnap {
  const version = useSyncExternalStore(
    subscribeMasteringBayMeters,
    getMasteringBayMeterVersion,
    getMasteringBayMeterVersion,
  );
  void version;
  return getMasteringBayMultiSnap();
}

export function useMasteringBayNugenSnap(): NugenMeterSnap {
  const version = useSyncExternalStore(
    subscribeMasteringBayMeters,
    getMasteringBayMeterVersion,
    getMasteringBayMeterVersion,
  );
  void version;
  return getMasteringBayNugenSnap();
}

export function useMasteringBayProcessLive(): ProcessLiveFeed {
  const version = useSyncExternalStore(
    subscribeMasteringBayMeters,
    getMasteringBayMeterVersion,
    getMasteringBayMeterVersion,
  );
  void version;
  return getMasteringBayProcessLive();
}
