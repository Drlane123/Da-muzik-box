'use client';

import { useAppWakeLock } from '@/app/hooks/useAppWakeLock';

/** Holds a screen wake lock for the lifetime of the open app tab. */
export default function AppWakeLockBootstrap() {
  useAppWakeLock(true);
  return null;
}
