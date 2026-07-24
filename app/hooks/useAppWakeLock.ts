import { useEffect } from 'react';

/**
 * Keep the display awake while Da Music Box is open and visible.
 * Uses the browser Screen Wake Lock API (same idea as video / presentation apps).
 * Releases when the tab is hidden or the app unmounts.
 */
export function useAppWakeLock(enabled = true): void {
  useEffect(() => {
    if (!enabled || typeof navigator === 'undefined' || typeof document === 'undefined') {
      return;
    }

    const nav = navigator as Navigator & {
      wakeLock?: {
        request: (type: 'screen') => Promise<WakeLockSentinel>;
      };
    };
    if (!nav.wakeLock?.request) return;

    let lock: WakeLockSentinel | null = null;
    let cancelled = false;

    const requestLock = async () => {
      if (cancelled || document.visibilityState !== 'visible') return;
      try {
        // Re-request after a previous release (tab hide, OS power policy, etc.).
        if (lock) {
          try {
            await lock.release();
          } catch {
            /* */
          }
          lock = null;
        }
        lock = await nav.wakeLock!.request('screen');
        lock.addEventListener('release', () => {
          lock = null;
        });
      } catch {
        // Unsupported, denied, or battery saver — fail quietly.
      }
    };

    void requestLock();

    const onVisibility = () => {
      if (document.visibilityState === 'visible') void requestLock();
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibility);
      if (lock) {
        void lock.release().catch(() => {});
        lock = null;
      }
    };
  }, [enabled]);
}
