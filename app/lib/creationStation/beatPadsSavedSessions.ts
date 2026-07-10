/**
 * User-saved Beat Pads sessions — loop pattern + kit snapshot per bank.
 */
import type { StoredPadSample } from '@/app/lib/padSampleStorage';
import { countSavedKitPads } from '@/app/lib/creationStation/beatLabSavedKits';
import {
  normalizeBeatPadsPattern,
  type BeatPadsDrumPattern,
  type BeatPadsGridStepsPerBar,
} from '@/app/lib/creationStation/beatLabDrumMachineSequencer';

export const BEAT_PADS_SAVED_SESSIONS_STORAGE_KEY = 'beatPads_savedSessions_v1';

export type BeatPadsSavedSession = {
  id: string;
  name: string;
  savedAt: number;
  bankIndex: number;
  loopBars: number;
  stepsPerBar: BeatPadsGridStepsPerBar;
  bpm: number;
  pattern: BeatPadsDrumPattern;
  kit?: {
    pads: Record<string, StoredPadSample>;
    label?: string;
  };
};

export function loadBeatPadsSavedSessions(): BeatPadsSavedSession[] {
  try {
    const raw = localStorage.getItem(BEAT_PADS_SAVED_SESSIONS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isBeatPadsSavedSession);
  } catch {
    return [];
  }
}

export function persistBeatPadsSavedSessions(sessions: BeatPadsSavedSession[]): boolean {
  try {
    localStorage.setItem(BEAT_PADS_SAVED_SESSIONS_STORAGE_KEY, JSON.stringify(sessions));
    return true;
  } catch {
    return false;
  }
}

function isBeatPadsSavedSession(v: unknown): v is BeatPadsSavedSession {
  if (!v || typeof v !== 'object') return false;
  const o = v as BeatPadsSavedSession;
  return (
    typeof o.id === 'string'
    && typeof o.name === 'string'
    && typeof o.savedAt === 'number'
    && typeof o.bankIndex === 'number'
    && typeof o.loopBars === 'number'
    && (o.stepsPerBar === 16 || o.stepsPerBar === 32)
    && typeof o.bpm === 'number'
    && Array.isArray(o.pattern)
  );
}

export function sanitizeBeatPadsSessionName(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ').slice(0, 48);
}

export function countBeatPadsSessionNotes(pattern: BeatPadsDrumPattern): number {
  let n = 0;
  for (const lane of pattern) {
    if (!Array.isArray(lane)) continue;
    for (const note of lane) {
      if (note && typeof note.len === 'number') n += Math.max(1, note.len);
    }
  }
  return n;
}

export type BeatPadsSessionSnapshot = Omit<BeatPadsSavedSession, 'id' | 'name' | 'savedAt'>;

export function upsertBeatPadsSavedSession(
  sessions: BeatPadsSavedSession[],
  name: string,
  snapshot: BeatPadsSessionSnapshot,
): { sessions: BeatPadsSavedSession[]; session: BeatPadsSavedSession; persisted: boolean } {
  const displayName = sanitizeBeatPadsSessionName(name) || 'My Beat Pads loop';
  const existing = sessions.find((s) => s.name.toLowerCase() === displayName.toLowerCase());
  const session: BeatPadsSavedSession = {
    id: existing?.id ?? `bps_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    name: displayName,
    savedAt: Date.now(),
    bankIndex: snapshot.bankIndex,
    loopBars: snapshot.loopBars,
    stepsPerBar: snapshot.stepsPerBar,
    bpm: snapshot.bpm,
    pattern: normalizeBeatPadsPattern(
      snapshot.pattern,
      snapshot.loopBars,
      snapshot.stepsPerBar,
    ),
    kit:
      snapshot.kit && countSavedKitPads(snapshot.kit.pads) > 0
        ? snapshot.kit
        : undefined,
  };
  const next = existing
    ? sessions.map((s) => (s.id === existing.id ? session : s))
    : [...sessions, session];
  const persisted = persistBeatPadsSavedSessions(next);
  return { sessions: next, session, persisted };
}

export function renameBeatPadsSavedSession(
  sessions: BeatPadsSavedSession[],
  id: string,
  name: string,
): BeatPadsSavedSession[] {
  const displayName = sanitizeBeatPadsSessionName(name) || 'My Beat Pads loop';
  const next = sessions.map((s) =>
    s.id === id ? { ...s, name: displayName, savedAt: Date.now() } : s,
  );
  persistBeatPadsSavedSessions(next);
  return next;
}

export function deleteBeatPadsSavedSession(
  sessions: BeatPadsSavedSession[],
  id: string,
): BeatPadsSavedSession[] {
  const next = sessions.filter((s) => s.id !== id);
  persistBeatPadsSavedSessions(next);
  return next;
}

export function findBeatPadsSavedSession(
  sessions: BeatPadsSavedSession[],
  id: string,
): BeatPadsSavedSession | undefined {
  return sessions.find((s) => s.id === id);
}
