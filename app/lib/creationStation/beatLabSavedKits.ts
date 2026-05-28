/**
 * User-saved Beat Lab drum kits (all 16 pads + sampler edits) in localStorage.
 */
import {
  loadPadSampleStore,
  padSampleKey,
  type PadSampleStore,
  type StoredPadSample,
} from '@/app/lib/padSampleStorage';

export const BEAT_LAB_SAVED_KITS_STORAGE_KEY = 'beatLab_savedKits_v1';

export type BeatLabSavedKit = {
  id: string;
  name: string;
  savedAt: number;
  /** Keys `"0"` … `"15"` — only pads that had a sample when saved. */
  pads: Record<string, StoredPadSample>;
};

export function loadBeatLabSavedKits(): BeatLabSavedKit[] {
  try {
    const raw = localStorage.getItem(BEAT_LAB_SAVED_KITS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isBeatLabSavedKit);
  } catch {
    return [];
  }
}

export function persistBeatLabSavedKits(kits: BeatLabSavedKit[]): void {
  try {
    localStorage.setItem(BEAT_LAB_SAVED_KITS_STORAGE_KEY, JSON.stringify(kits));
  } catch {
    /* quota / private mode */
  }
}

function isBeatLabSavedKit(v: unknown): v is BeatLabSavedKit {
  if (!v || typeof v !== 'object') return false;
  const o = v as BeatLabSavedKit;
  return (
    typeof o.id === 'string' &&
    typeof o.name === 'string' &&
    typeof o.savedAt === 'number' &&
    o.pads != null &&
    typeof o.pads === 'object'
  );
}

function cloneStoredPad(row: StoredPadSample): StoredPadSample {
  return JSON.parse(JSON.stringify(row)) as StoredPadSample;
}

/** Snapshot every loaded pad on a bank (samples + FX / trim / labels / root BPM). */
export function captureBankKitPads(
  store: PadSampleStore,
  bankIndex: number,
): Record<string, StoredPadSample> {
  const out: Record<string, StoredPadSample> = {};
  for (let pi = 0; pi < 16; pi++) {
    const row = store[padSampleKey(bankIndex, pi)];
    if (row?.data) out[String(pi)] = cloneStoredPad(row);
  }
  return out;
}

export function captureActiveBankKitPads(bankIndex: number): Record<string, StoredPadSample> {
  return captureBankKitPads(loadPadSampleStore(), bankIndex);
}

export function countSavedKitPads(pads: Record<string, StoredPadSample>): number {
  return Object.keys(pads).length;
}

export function sanitizeKitName(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ').slice(0, 48);
}

export function upsertBeatLabSavedKit(
  kits: BeatLabSavedKit[],
  name: string,
  pads: Record<string, StoredPadSample>,
): { kits: BeatLabSavedKit[]; kit: BeatLabSavedKit } {
  const clean = sanitizeKitName(name);
  const displayName = clean || 'My kit';
  const existing = kits.find((k) => k.name.toLowerCase() === displayName.toLowerCase());
  const kit: BeatLabSavedKit = {
    id: existing?.id ?? `kit_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    name: displayName,
    savedAt: Date.now(),
    pads,
  };
  const next = existing
    ? kits.map((k) => (k.id === existing.id ? kit : k))
    : [...kits, kit];
  persistBeatLabSavedKits(next);
  return { kits: next, kit };
}

export function renameBeatLabSavedKit(
  kits: BeatLabSavedKit[],
  id: string,
  name: string,
): BeatLabSavedKit[] {
  const displayName = sanitizeKitName(name) || 'My kit';
  const next = kits.map((k) => (k.id === id ? { ...k, name: displayName, savedAt: Date.now() } : k));
  persistBeatLabSavedKits(next);
  return next;
}

export function deleteBeatLabSavedKit(kits: BeatLabSavedKit[], id: string): BeatLabSavedKit[] {
  const next = kits.filter((k) => k.id !== id);
  persistBeatLabSavedKits(next);
  return next;
}

export function findBeatLabSavedKit(kits: BeatLabSavedKit[], id: string): BeatLabSavedKit | undefined {
  return kits.find((k) => k.id === id);
}
