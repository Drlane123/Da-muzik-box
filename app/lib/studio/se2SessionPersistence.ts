/**
 * Studio Editor 2 — local session snapshot (tracks + transport UI).
 * Survives leaving SE2 for Beat Lab and browser reload; cleared only via explicit reset.
 */
import { se2MigrateGenoChordCreatorTrackRow } from '@/app/lib/studio/se2ChordGenieTrack';
import { audioBufferToWavBase64, wavBase64ToAudioBuffer } from '@/app/lib/studioProjectPersistence';

export const SE2_SESSION_STORAGE_KEY = 'se2-studio-session-v1';

export const SE2_SESSION_VERSION = 1 as const;

export type Se2SessionFileV1 = {
  version: typeof SE2_SESSION_VERSION;
  savedAt: string;
  tracks: unknown[];
  selectedTrackIndex?: number;
  bpm?: number;
  loopOn?: boolean;
  loopBars?: number;
  loopStartBeat?: number;
  loopEndBeat?: number;
  beatsPerBar?: number;
  beatPadsMachineOpen?: boolean;
  songKeyRoot?: number;
  songKeyMode?: 'major' | 'minor';
  /** Timeline horizontal zoom (arrange view). */
  timelineZoom?: number;
  /** Timeline audio clip payloads keyed by `StudioAudioClip.sourceId`. */
  audioSources?: Record<string, string>;
};

export type Se2SessionWritePayload = Omit<Se2SessionFileV1, 'version' | 'savedAt'>;

function isPersistedTrack(v: unknown): v is Record<string, unknown> {
  if (!v || typeof v !== 'object') return false;
  const t = v as Record<string, unknown>;
  return (
    typeof t.id === 'string' &&
    typeof t.name === 'string' &&
    typeof t.kind === 'string' &&
    typeof t.colorHex === 'string' &&
    Array.isArray(t.notes) &&
    Array.isArray(t.audioClips)
  );
}

/** Validate + shallow-clone persisted track rows. */
export function normalizeSe2SessionTracks(raw: unknown[]): Record<string, unknown>[] {
  return raw.filter(isPersistedTrack).map((t) => se2MigrateGenoChordCreatorTrackRow({ ...t }));
}

export function readSe2SessionSnapshot(): Se2SessionFileV1 | null {
  try {
    const raw =
      typeof localStorage !== 'undefined' ? localStorage.getItem(SE2_SESSION_STORAGE_KEY) : null;
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Se2SessionFileV1;
    if (!parsed || parsed.version !== SE2_SESSION_VERSION || !Array.isArray(parsed.tracks)) {
      return null;
    }
    const tracks = normalizeSe2SessionTracks(parsed.tracks);
    return { ...parsed, tracks };
  } catch {
    return null;
  }
}

export function writeSe2SessionSnapshot(payload: Se2SessionWritePayload): void {
  try {
    const file: Se2SessionFileV1 = {
      version: SE2_SESSION_VERSION,
      savedAt: new Date().toISOString(),
      ...payload,
      tracks: payload.tracks.map((t) => ({ ...t })),
    };
    localStorage.setItem(SE2_SESSION_STORAGE_KEY, JSON.stringify(file));
  } catch (err) {
    console.warn('SE2: session save failed (quota or private mode)', err);
  }
}

export function clearSe2SessionSnapshot(): void {
  try {
    localStorage.removeItem(SE2_SESSION_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function collectSe2AudioSourceIds(tracks: readonly { audioClips?: readonly { sourceId?: string }[] }[]): string[] {
  const ids = new Set<string>();
  for (const tr of tracks) {
    for (const clip of tr.audioClips ?? []) {
      if (clip?.sourceId) ids.add(clip.sourceId);
    }
  }
  return [...ids];
}

export async function encodeSe2AudioSources(
  buffers: ReadonlyMap<string, AudioBuffer>,
  sourceIds: readonly string[],
): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const id of sourceIds) {
    const buf = buffers.get(id);
    if (!buf) continue;
    try {
      out[id] = await audioBufferToWavBase64(buf);
    } catch (e) {
      console.warn('SE2: failed to encode audio source', id, e);
    }
  }
  return out;
}

export async function restoreSe2AudioSources(
  sources: Record<string, string> | undefined,
  ctx: AudioContext,
  target: Map<string, AudioBuffer>,
): Promise<void> {
  if (!sources) return;
  for (const [id, b64] of Object.entries(sources)) {
    if (!b64 || target.has(id)) continue;
    try {
      target.set(id, await wavBase64ToAudioBuffer(b64, ctx));
    } catch (e) {
      console.warn('SE2: failed to decode audio source', id, e);
    }
  }
}

export function clampSe2SessionSelectedTrack(index: number | undefined, trackCount: number): number {
  if (!trackCount) return 0;
  const idx = typeof index === 'number' && Number.isFinite(index) ? Math.round(index) : 0;
  return Math.max(0, Math.min(trackCount - 1, idx));
}

export function clampSe2SessionBpm(bpm: number | undefined): number {
  if (typeof bpm !== 'number' || !Number.isFinite(bpm)) return 120;
  return Math.max(40, Math.min(300, Math.round(bpm)));
}
