/**
 * Shipped Studio Editor 2 factory template — owner's startup session (6-track layout).
 * Re-applied whenever {@link SE2_FACTORY_DEFAULTS_VERSION} is newer than `dmb_se2_factory_seeded_v1`.
 */
import factoryBundle from './se2FactoryDefaults.json';
import {
  normalizeSe2SessionTracks,
  SE2_SESSION_STORAGE_KEY,
  type Se2SessionFileV1,
} from '@/app/lib/studio/se2SessionPersistence';
import { writeSe2OwnerStartupTemplate } from '@/app/lib/studio/se2OwnerStartupTemplate';
import {
  SE2_STUDIO_MIXER_STORAGE_KEY,
  type Se2StudioMixerSnapshot,
} from '@/app/lib/studio/se2StudioMixerState';

export const SE2_FACTORY_DEFAULTS_VERSION = 8;
export const SE2_FACTORY_SEED_KEY = 'dmb_se2_factory_seeded_v1';

export const SE2_FACTORY_STORAGE_KEYS = [
  SE2_SESSION_STORAGE_KEY,
  SE2_STUDIO_MIXER_STORAGE_KEY,
  'dmb_shared_piano_snap_subdiv',
] as const;

function stripChromeLocalStoragePrefix(s: string): string {
  return s.charCodeAt(0) === 1 ? s.slice(1) : s;
}

function factoryLocalStorageEntries(): [string, string][] {
  const raw = factoryBundle.localStorage as Record<string, string>;
  return Object.entries(raw).map(([key, value]) => [
    stripChromeLocalStoragePrefix(key),
    stripChromeLocalStoragePrefix(value),
  ]);
}

/** Parsed bundled session. */
export function readSe2FactoryDefaultSession(): Se2SessionFileV1 | null {
  try {
    const entry = factoryLocalStorageEntries().find(([k]) => k === SE2_SESSION_STORAGE_KEY);
    if (!entry) return null;
    const parsed = JSON.parse(entry[1]) as Se2SessionFileV1;
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.tracks)) return null;
    return { ...parsed, tracks: normalizeSe2SessionTracks(parsed.tracks) };
  } catch {
    return null;
  }
}

export function hasSe2PersistedSession(): boolean {
  try {
    return localStorage.getItem(SE2_SESSION_STORAGE_KEY) != null;
  } catch {
    return false;
  }
}

function needsSe2FactorySeed(): boolean {
  if (typeof localStorage === 'undefined') return false;
  try {
    const seeded = localStorage.getItem(SE2_FACTORY_SEED_KEY);
    return seeded !== String(SE2_FACTORY_DEFAULTS_VERSION);
  } catch {
    return true;
  }
}

function syncOwnerStartupFromFactoryBundle(): void {
  const session = readSe2FactoryDefaultSession();
  if (!session) return;
  let mixer: Se2StudioMixerSnapshot | null = null;
  const pianoSnapSubdiv =
    factoryLocalStorageEntries().find(([k]) => k === 'dmb_shared_piano_snap_subdiv')?.[1] ?? '4';
  const mixerRaw = factoryLocalStorageEntries().find(([k]) => k === SE2_STUDIO_MIXER_STORAGE_KEY)?.[1];
  if (mixerRaw) {
    try {
      mixer = JSON.parse(mixerRaw) as Se2StudioMixerSnapshot;
    } catch {
      mixer = null;
    }
  }
  writeSe2OwnerStartupTemplate({
    session,
    mixer,
    pianoSnapSubdiv,
    view: { showMixer: false, showPianoRoll: false },
  });
}

/** Overwrite SE2 session keys from the bundled factory snapshot. */
export function forceApplySe2FactoryDefaults(): void {
  if (typeof localStorage === 'undefined') return;
  for (const [cleanKey, cleanValue] of factoryLocalStorageEntries()) {
    if (!SE2_FACTORY_STORAGE_KEYS.includes(cleanKey as (typeof SE2_FACTORY_STORAGE_KEYS)[number])) {
      continue;
    }
    try {
      localStorage.setItem(cleanKey, cleanValue);
    } catch {
      /* quota */
    }
  }
  syncOwnerStartupFromFactoryBundle();
  try {
    localStorage.setItem(SE2_FACTORY_SEED_KEY, String(SE2_FACTORY_DEFAULTS_VERSION));
  } catch {
    /* ignore */
  }
}

/** Apply bundled factory template when the shipped version is newer than the last seed. */
export function applySe2FactoryDefaultsIfNeeded(): void {
  if (!needsSe2FactorySeed()) return;
  forceApplySe2FactoryDefaults();
}
