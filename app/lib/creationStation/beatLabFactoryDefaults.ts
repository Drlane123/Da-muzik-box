/**
 * Shipped Beat Lab factory state — captured from the owner's default session.
 * Applied once on cold start when `creationStation_banks` is not in localStorage.
 */
import factoryBundle from './beatLabFactoryDefaults.json';

export const BEAT_LAB_DEFAULT_BPM = 102;
export const BEAT_LAB_FACTORY_DEFAULTS_VERSION = 1;
export const BEAT_LAB_FACTORY_SEED_KEY = 'dmb_beat_lab_factory_seeded_v1';

export const BEAT_LAB_FACTORY_STORAGE_KEYS = [
  'creationStation_banks',
  'creationStation_patternSlots',
  'creationStation_padChannels',
  'creationStation_padSamples_v1',
  'beatLab_tileGrid_v1',
  'dmb_shared_piano_snap_subdiv',
  'beatLab_savedKits_v1',
  'da-music-box-creation-station-clip-data-v1',
] as const;

function stripChromeLocalStoragePrefix(s: string): string {
  return s.charCodeAt(0) === 1 ? s.slice(1) : s;
}

export function hasBeatLabPersistedBanks(): boolean {
  try {
    return localStorage.getItem('creationStation_banks') != null;
  } catch {
    return false;
  }
}

/** Seed Beat Lab localStorage from the bundled factory snapshot (first launch only). */
export function applyBeatLabFactoryDefaultsIfNeeded(): void {
  if (typeof localStorage === 'undefined') return;
  if (hasBeatLabPersistedBanks()) return;

  try {
    const seeded = localStorage.getItem(BEAT_LAB_FACTORY_SEED_KEY);
    if (seeded === String(BEAT_LAB_FACTORY_DEFAULTS_VERSION)) return;
  } catch {
    /* continue */
  }

  const raw = factoryBundle.localStorage as Record<string, string>;
  for (const [key, value] of Object.entries(raw)) {
    const cleanKey = stripChromeLocalStoragePrefix(key);
    if (!BEAT_LAB_FACTORY_STORAGE_KEYS.includes(cleanKey as (typeof BEAT_LAB_FACTORY_STORAGE_KEYS)[number])) {
      continue;
    }
    try {
      localStorage.setItem(cleanKey, stripChromeLocalStoragePrefix(value));
    } catch {
      /* quota — still mark partial seed */
    }
  }

  try {
    localStorage.setItem(BEAT_LAB_FACTORY_SEED_KEY, String(BEAT_LAB_FACTORY_DEFAULTS_VERSION));
  } catch {
    /* ignore */
  }
}
