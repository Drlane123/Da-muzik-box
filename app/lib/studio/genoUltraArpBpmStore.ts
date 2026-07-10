/**
 * Per-track Geno Ultra ARP tempo — survives panel remounts and track switches.
 * Track field `genoUltraArpBpm` is primary; this map is a session/local backup.
 */
import {
  clampGenoUltraArpBpm,
  GENO_ULTRA_ARP_DEFAULT_BPM,
} from '@/app/lib/studio/genoUltraArpState';

const STORAGE_KEY = 'damusic-geno-ultra-arp-bpm-by-track-v1';

const memory = new Map<string, number>();

function readDisk(): void {
  if (typeof localStorage === 'undefined') return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    for (const [id, v] of Object.entries(parsed)) {
      if (typeof v === 'number' && Number.isFinite(v)) {
        memory.set(id, clampGenoUltraArpBpm(v));
      }
    }
  } catch {
    /* ignore */
  }
}

let diskLoaded = false;
function ensureDisk(): void {
  if (diskLoaded) return;
  diskLoaded = true;
  readDisk();
}

function writeDisk(): void {
  if (typeof localStorage === 'undefined') return;
  try {
    const obj: Record<string, number> = {};
    for (const [id, bpm] of memory) obj[id] = bpm;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
  } catch {
    /* quota */
  }
}

/** Resolve this track's local ARP tempo. Never falls back to SE2 session BPM. */
export function getGenoUltraArpBpmForTrack(
  trackId: string,
  trackFieldBpm: number | undefined,
): number | undefined {
  ensureDisk();
  if (typeof trackFieldBpm === 'number' && Number.isFinite(trackFieldBpm)) {
    return clampGenoUltraArpBpm(trackFieldBpm);
  }
  const cached = memory.get(trackId);
  return cached != null ? cached : undefined;
}

export function setGenoUltraArpBpmForTrack(trackId: string, bpm: number): number {
  ensureDisk();
  const next = clampGenoUltraArpBpm(bpm);
  memory.set(trackId, next);
  writeDisk();
  return next;
}

export function genoUltraArpBpmOrDefault(bpm: number | undefined): number {
  return bpm != null ? clampGenoUltraArpBpm(bpm) : GENO_ULTRA_ARP_DEFAULT_BPM;
}
