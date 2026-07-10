/**
 * SE2 Beat Pads main volume — dock-header knob only (not mixer master / Settings).
 * Linear 0…1 trim applied at pad sample playback. Persists so you set it once.
 */
const STORAGE_KEY = 'se2_beatPads_mainVolume_v1';

/** Fresh default — owner-tuned sweet spot for SE2 Beat Pads vs other lanes. */
export const SE2_BEAT_PADS_MAIN_VOLUME_DEFAULT = 0.26;

let liveVolume = SE2_BEAT_PADS_MAIN_VOLUME_DEFAULT;
let hydrated = false;
const listeners = new Set<() => void>();

function clampVolume(v: number): number {
  if (!Number.isFinite(v)) return SE2_BEAT_PADS_MAIN_VOLUME_DEFAULT;
  return Math.max(0, Math.min(1, v));
}

function hydrateFromStorage(): void {
  if (hydrated || typeof localStorage === 'undefined') {
    hydrated = true;
    return;
  }
  hydrated = true;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw == null) return;
    const n = Number(raw);
    if (Number.isFinite(n)) liveVolume = clampVolume(n);
  } catch {
    /* */
  }
}

function persist(v: number): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, String(v));
  } catch {
    /* */
  }
}

function notify(): void {
  for (const fn of listeners) {
    try {
      fn();
    } catch {
      /* */
    }
  }
}

/** Live output gain for SE2 Beat Pads playback (0…1). */
export function getSe2BeatPadsMainVolume(): number {
  hydrateFromStorage();
  return liveVolume;
}

export function setSe2BeatPadsMainVolume(next: number): number {
  hydrateFromStorage();
  const v = clampVolume(next);
  if (v === liveVolume) return v;
  liveVolume = v;
  persist(v);
  notify();
  return v;
}

export function subscribeSe2BeatPadsMainVolume(fn: () => void): () => void {
  hydrateFromStorage();
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
