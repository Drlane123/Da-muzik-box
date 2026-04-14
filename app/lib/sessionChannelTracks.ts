/**
 * Shared DAW session: multiple modules contribute timeline rows via stable `audioTrack` slots:
 * - Creation Station: mixer channels 1–17 (triggerChannel)
 * - AI Pattern Generator: default 8 lanes from 18 — expands contiguously; Arranger base shifts after last AI slot
 * - Master Arranger: section lanes from getMasterArrangerSessionBase() + (arrTrack.id - 1)
 * Studio Editor merges by `audioTrack` (idempotent).
 */

export const SESSION_CHANNELS_MANIFEST_KEY = 'da-music-box-session-channels-manifest-v1';

/** AI Pattern lanes start here — default count is 8; session can grow beyond that contiguously. */
export const AI_PATTERN_SESSION_BASE = 18;
/** Default / minimum AI Pattern lane count (legacy projects assume 8 lanes 18–25). */
export const AI_PATTERN_TRACK_COUNT = 8;

export const AI_PATTERN_SESSION_KEY = 'da-music-box-ai-pattern-session-tracks-v1';

/** Master Arranger lanes — dedicated in-range block after default AI lanes (keeps Studio track space bounded). */
export const MASTER_ARRANGER_SESSION_BASE = 26;

/** Default contiguous pool size for Master Arranger (actual reserved range grows with manifest + dynamic base). */
export const MASTER_ARRANGER_RESERVED_SLOT_COUNT = 36;

/** Studio-only timeline rows (recording / imports) use audioTrack ≥ this (legacy floor; actual floor is computed dynamically). */
export const SESSION_STUDIO_USER_TRACK_BASE = 62;

export const MASTER_ARRANGER_SESSION_KEY = 'da-music-box-master-arranger-session-tracks-v1';

/** CustomEvent name — Studio Editor listens to merge new channel tracks without navigation. */
export const DA_SESSION_TRACKS_SYNC_EVENT = 'da-session-tracks-sync';

/** Single source for pad labels/colors — Creation Station pads 0–15 map to mixer CH by `padChannels[pad]`. */
export const CREATION_PAD_NAMES = [
  'Kick',
  'Snare',
  'Clap',
  'Hi-Hat',
  'Open HH',
  'Tom Hi',
  'Tom Lo',
  'Rim',
  'Perc 1',
  'Perc 2',
  'Crash',
  'Ride',
  'Shaker',
  'Cowbell',
  'Snap',
  'SUB BASS',
] as const;

export const CREATION_PAD_COLORS = [
  '#00F5FF',
  '#FF006E',
  '#8B5CF6',
  '#00FF88',
  '#FFE500',
  '#FF4444',
  '#00D9FF',
  '#FF8800',
  '#A855F7',
  '#22D3EE',
  '#F472B6',
  '#34D399',
  '#FBBF24',
  '#EF4444',
  '#6366F1',
  '#EC4899',
] as const;

/** SUB BASS scheduler lane — fixed CH17. */
export const CREATION_SUB_CHANNEL = 17;

const SUB_CHANNEL = CREATION_SUB_CHANNEL;

/**
 * Canonical label for a Creation mixer channel when using default CHn ↔ pad(n−1) mapping (no routing table).
 * CH1 → Kick (CH1), …, CH16 → SUB BASS (CH16), CH17 → SUB BASS (CH17).
 */
export function getDefaultCreationChannelLabel(channelId: number): string {
  if (channelId === SUB_CHANNEL) return 'SUB BASS (CH17)';
  if (channelId >= 1 && channelId <= 16) {
    return `${CREATION_PAD_NAMES[channelId - 1]} (CH${channelId})`;
  }
  return `CH${channelId}`;
}

/**
 * Label for channel `channelId` from the live pad→channel routing table (authoritative vs default-only baseline).
 */
export function getCreationChannelDisplayName(channelId: number, padChannels: number[]): string {
  const routePad = padChannels.findIndex((ch, i) => i < 16 && ch === channelId);
  if (routePad >= 0) {
    return `${CREATION_PAD_NAMES[routePad]} (CH${channelId})`;
  }
  if (channelId === SUB_CHANNEL) return 'SUB BASS (CH17)';
  return getDefaultCreationChannelLabel(channelId);
}

const NOTE_COLORS_AI = [
  '#D500F9',
  '#00E5FF',
  '#ff6b35',
  '#00ff88',
  '#ffcc00',
  '#a78bfa',
  '#f472b6',
  '#60a5fa',
];

export type BankDrums = { drums: boolean[][] };

/**
 * A mixer channel is "used" if any bank has drum hits on a pad routed to that channel,
 * or SUB channel is armed (sub bass line).
 */
export function computeUsedCreationChannelMeta(
  banks: BankDrums[],
  padChannels: number[],
  subOn: boolean,
): Map<number, { name: string; color: string }> {
  const out = new Map<number, { name: string; color: string }>();

  for (const bank of banks) {
    for (let padIdx = 0; padIdx < 16; padIdx++) {
      const row = bank.drums[padIdx];
      if (!row || !row.some(Boolean)) continue;
      const ch = padChannels[padIdx];
      if (!Number.isFinite(ch) || ch < 1) continue;
      if (!out.has(ch)) {
        out.set(ch, {
          name: getCreationChannelDisplayName(ch, padChannels),
          color: CREATION_PAD_COLORS[padIdx] ?? '#888',
        });
      }
    }
  }

  if (subOn && !out.has(SUB_CHANNEL)) {
    out.set(SUB_CHANNEL, { name: getDefaultCreationChannelLabel(SUB_CHANNEL), color: '#D500F9' });
  }

  return out;
}

/** AI Pattern: session lanes from 18 upward — default 8, expands with `patternTracks.length`. */
export function computeAiPatternSessionMeta(
  patternTracks: { name: string }[],
): Map<number, { name: string; color: string; trackType?: string }> {
  const m = new Map<number, { name: string; color: string; trackType?: string }>();
  const palette = NOTE_COLORS_AI;
  const n = Math.max(AI_PATTERN_TRACK_COUNT, patternTracks.length);
  for (let i = 0; i < n; i++) {
    const slot = AI_PATTERN_SESSION_BASE + i;
    const src = patternTracks[i];
    const name = src?.name?.trim() || `AI Pattern ${i + 1}`;
    m.set(slot, {
      name: `AI: ${name}`,
      color: palette[i % palette.length],
      trackType: 'MIDI',
    });
  }
  return m;
}

/** Master Arranger row → session lane (stable id-based slot; base shifts if AI Pattern expands). */
export function computeMasterArrangerSessionMeta(
  arrTracks: { id: number; name: string; color: string }[],
): Map<number, { name: string; color: string; trackType?: string }> {
  const m = new Map<number, { name: string; color: string; trackType?: string }>();
  const base = getMasterArrangerSessionBase();
  for (const t of arrTracks) {
    const slot = base + Math.max(0, t.id - 1);
    if (slot > 2000) continue;
    m.set(slot, {
      name: `Song: ${t.name}`,
      color: t.color,
      trackType: 'MIDI',
    });
  }
  return m;
}

export type SessionTrackMeta = { name: string; color: string; trackType?: string };

export type MergeableStudioTrack = {
  id: number;
  name: string;
  type: string;
  color: string;
  muted: boolean;
  solo: boolean;
  locked: boolean;
  volume: number;
  clips: unknown[];
  audioTrack?: number;
};

/**
 * Collapse duplicate timeline rows that share the same session `audioTrack` (merge clips into one row).
 */
export function dedupeTracksByAudioTrack<T extends MergeableStudioTrack>(tracks: T[]): T[] {
  const byAt = new Map<number, T>();
  const unkeyed: T[] = [];
  for (const t of tracks) {
    const at = t.audioTrack;
    if (at == null || !Number.isFinite(at)) {
      unkeyed.push(t);
      continue;
    }
    const prev = byAt.get(at);
    if (!prev) {
      const clips = Array.isArray(t.clips) ? [...t.clips] : [];
      byAt.set(at, { ...t, clips } as T);
    } else {
      const mergedClips = [
        ...(Array.isArray(prev.clips) ? prev.clips : []),
        ...(Array.isArray(t.clips) ? t.clips : []),
      ];
      // Stable timeline id: keep metadata from the row with the lower id; merge all clips.
      const primary = prev.id <= t.id ? prev : t;
      byAt.set(at, {
        ...primary,
        audioTrack: at,
        clips: mergedClips,
      } as T);
    }
  }
  return [...byAt.values(), ...unkeyed];
}

/**
 * Studio timeline source of truth: one row per manifest slot, ordered by session channel (1,2,… then 26+).
 * Session metadata (name/color/type) overwrites row labels. Studio-only rows (audioTrack not in manifest) append after.
 * Replaces append-only merge to avoid duplicate `audioTrack` rows and wrong ordering.
 */
export function rebuildStudioTracksFromSessionManifest<T extends MergeableStudioTrack>(
  existing: T[],
  manifest: Map<number, SessionTrackMeta>,
): T[] {
  if (manifest.size === 0) {
    return dedupeTracksByAudioTrack(existing);
  }

  const flat = dedupeTracksByAudioTrack(existing);
  const byAt = new Map<number, T>();
  const unkeyed: T[] = [];
  for (const t of flat) {
    const at = t.audioTrack;
    if (at != null && Number.isFinite(at)) {
      byAt.set(at, t);
    } else {
      unkeyed.push(t);
    }
  }

  const slots = Array.from(manifest.keys()).sort((a, b) => a - b);
  const usedIds = new Set<number>();
  let maxId = existing.length ? Math.max(0, ...existing.map((t) => t.id)) : 0;

  const result: T[] = [];

  for (const slot of slots) {
    const meta = manifest.get(slot)!;
    let row = byAt.get(slot);
    if (!row) {
      maxId += 1;
      while (usedIds.has(maxId)) maxId += 1;
      usedIds.add(maxId);
      row = {
        id: maxId,
        name: meta.name,
        type: meta.trackType || 'Drum',
        color: meta.color,
        muted: false,
        solo: false,
        locked: false,
        volume: 75,
        clips: [],
        audioTrack: slot,
      } as unknown as T;
    } else {
      usedIds.add(row.id);
      row = {
        ...row,
        name: meta.name,
        color: meta.color,
        type: (meta.trackType || row.type) as string,
        audioTrack: slot,
      } as T;
    }
    result.push(row);
  }

  const manifestSlots = new Set(slots);
  const extraAudioTracks = Array.from(byAt.keys())
    .filter((at) => !manifestSlots.has(at))
    .sort((a, b) => a - b);

  for (const at of extraAudioTracks) {
    const row = byAt.get(at)!;
    if (usedIds.has(row.id)) continue;
    usedIds.add(row.id);
    result.push(row);
  }

  for (const t of unkeyed) {
    let id = t.id;
    if (usedIds.has(id)) {
      maxId += 1;
      while (usedIds.has(maxId)) maxId += 1;
      id = maxId;
    }
    usedIds.add(id);
    result.push(id === t.id ? t : ({ ...t, id } as T));
  }

  return result;
}

/**
 * @deprecated Prefer `rebuildStudioTracksFromSessionManifest` in Studio — append-only; can leave duplicate audioTrack rows.
 * For each session slot (audioTrack), ensure exactly one Studio row. Idempotent.
 */
export function mergeSessionTracksIntoStudioTracks<T extends MergeableStudioTrack>(
  tracks: T[],
  channelMeta: Map<number, SessionTrackMeta>,
): T[] {
  return rebuildStudioTracksFromSessionManifest(tracks, channelMeta);
}

/** @deprecated use mergeSessionTracksIntoStudioTracks — alias for Creation-only callers */
export function mergeCreationChannelsIntoStudioTracks<T extends MergeableStudioTrack>(
  tracks: T[],
  channelMeta: Map<number, { name: string; color: string }>,
): T[] {
  const m = new Map<number, SessionTrackMeta>();
  channelMeta.forEach((v, k) => m.set(k, { ...v, trackType: 'Drum' }));
  return mergeSessionTracksIntoStudioTracks(tracks, m);
}

export function readCreationChannelManifestFromStorage(): Map<number, { name: string; color: string }> {
  try {
    const raw = localStorage.getItem(SESSION_CHANNELS_MANIFEST_KEY);
    if (!raw) return new Map();
    const data = JSON.parse(raw) as {
      channels?: { channelId: number; name: string; color: string }[];
    };
    const m = new Map<number, { name: string; color: string }>();
    for (const c of data.channels || []) {
      if (typeof c.channelId === 'number' && c.name) {
        m.set(c.channelId, { name: c.name, color: c.color || '#888888' });
      }
    }
    return m;
  } catch {
    return new Map();
  }
}

export function writeCreationChannelManifestToStorage(
  meta: Map<number, { name: string; color: string }>,
): void {
  const channels = Array.from(meta.entries()).map(([channelId, v]) => ({
    channelId,
    name: v.name,
    color: v.color,
  }));
  try {
    localStorage.setItem(
      SESSION_CHANNELS_MANIFEST_KEY,
      JSON.stringify({ channels, updatedAt: Date.now() }),
    );
  } catch {
    /* quota / private mode */
  }
}

export function writeAiPatternSessionManifestToStorage(meta: Map<number, SessionTrackMeta>): void {
  const tracks = Array.from(meta.entries()).map(([audioTrack, v]) => ({
    audioTrack,
    name: v.name,
    color: v.color,
    trackType: v.trackType || 'MIDI',
  }));
  try {
    localStorage.setItem(
      AI_PATTERN_SESSION_KEY,
      JSON.stringify({ tracks, updatedAt: Date.now() }),
    );
  } catch {
    /* ignore */
  }
}

export function readAiPatternSessionManifestFromStorage(): Map<number, SessionTrackMeta> {
  try {
    const raw = localStorage.getItem(AI_PATTERN_SESSION_KEY);
    if (!raw) return new Map();
    const data = JSON.parse(raw) as {
      tracks?: { audioTrack: number; name: string; color: string; trackType?: string }[];
    };
    const m = new Map<number, SessionTrackMeta>();
    for (const t of data.tracks || []) {
      if (typeof t.audioTrack === 'number' && t.name) {
        m.set(t.audioTrack, {
          name: t.name,
          color: t.color || '#888888',
          trackType: t.trackType || 'MIDI',
        });
      }
    }
    return m;
  } catch {
    return new Map();
  }
}

/** Highest AI Pattern session slot (≥18) from persisted manifest, or 0 if none. */
export function getMaxAiSessionSlotFromStorage(): number {
  let maxK = 0;
  readAiPatternSessionManifestFromStorage().forEach((_, k) => {
    if (k >= AI_PATTERN_SESSION_BASE) maxK = Math.max(maxK, k);
  });
  return maxK;
}

/** Contiguous AI lane count: at least default 8; grows when manifest uses higher `audioTrack` slots. */
export function getAiPatternLaneCountEffective(): number {
  const maxK = getMaxAiSessionSlotFromStorage();
  return Math.max(
    AI_PATTERN_TRACK_COUNT,
    maxK >= AI_PATTERN_SESSION_BASE ? maxK - AI_PATTERN_SESSION_BASE + 1 : AI_PATTERN_TRACK_COUNT,
  );
}

/**
 * First Master Arranger session lane. Remains 26 when AI uses only default slots 18–25;
 * shifts to maxAiSlot+1 when AI Pattern expands beyond slot 25 (no overlap with extended AI lanes).
 */
export function getMasterArrangerSessionBase(): number {
  const maxAi = getMaxAiSessionSlotFromStorage();
  if (!maxAi || maxAi <= AI_PATTERN_SESSION_BASE + AI_PATTERN_TRACK_COUNT - 1) {
    return MASTER_ARRANGER_SESSION_BASE;
  }
  return maxAi + 1;
}

export function writeMasterArrangerSessionManifestToStorage(meta: Map<number, SessionTrackMeta>): void {
  const tracks = Array.from(meta.entries()).map(([audioTrack, v]) => ({
    audioTrack,
    name: v.name,
    color: v.color,
    trackType: v.trackType || 'MIDI',
  }));
  try {
    localStorage.setItem(
      MASTER_ARRANGER_SESSION_KEY,
      JSON.stringify({ tracks, updatedAt: Date.now() }),
    );
  } catch {
    /* ignore */
  }
}

export function readMasterArrangerSessionManifestFromStorage(): Map<number, SessionTrackMeta> {
  try {
    const raw = localStorage.getItem(MASTER_ARRANGER_SESSION_KEY);
    if (!raw) return new Map();
    const data = JSON.parse(raw) as {
      tracks?: { audioTrack: number; name: string; color: string; trackType?: string }[];
    };
    const m = new Map<number, SessionTrackMeta>();
    for (const t of data.tracks || []) {
      if (typeof t.audioTrack === 'number' && t.name) {
        m.set(t.audioTrack, {
          name: t.name,
          color: t.color || '#888888',
          trackType: t.trackType || 'MIDI',
        });
      }
    }
    return m;
  } catch {
    return new Map();
  }
}

/**
 * All session `audioTrack` numbers that are reserved for module defaults or manifests.
 * Studio user allocation must start at or above `getNextStudioUserAudioTrackFloor()`.
 */
export function getSessionReservedTrackNumbers(): Set<number> {
  const s = new Set<number>();
  for (let i = 1; i <= 17; i++) s.add(i);

  const laneCount = getAiPatternLaneCountEffective();
  for (let i = 0; i < laneCount; i++) s.add(AI_PATTERN_SESSION_BASE + i);

  const arrBase = getMasterArrangerSessionBase();
  let maxArr = arrBase + MASTER_ARRANGER_RESERVED_SLOT_COUNT - 1;
  readMasterArrangerSessionManifestFromStorage().forEach((_, k) => {
    if (k >= arrBase) maxArr = Math.max(maxArr, k);
  });
  for (let k = arrBase; k <= maxArr; k++) s.add(k);

  return s;
}

/** Next safe `audioTrack` for Studio-only rows (recording / imports) — never collides with reserved module ranges. */
export function getNextStudioUserAudioTrackFloor(): number {
  let max = 0;
  getSessionReservedTrackNumbers().forEach((k) => {
    max = Math.max(max, k);
  });
  return Math.max(SESSION_STUDIO_USER_TRACK_BASE, max + 1);
}

/**
 * One master session track list: Creation (1–17) + AI Pattern (18+ contiguous) + Master Arranger (dynamic base),
 * overlaid with module manifests. Studio merges this so the timeline matches the shared session model.
 */
export function readCombinedSessionTrackManifest(): Map<number, SessionTrackMeta> {
  const combined = new Map<number, SessionTrackMeta>();

  // ── Baseline Creation Station CH1–CH17 (canonical default mapping — overlaid by manifest from Creation Station)
  for (let ch = 1; ch <= 17; ch++) {
    const isSub = ch === SUB_CHANNEL;
    combined.set(ch, {
      name: getDefaultCreationChannelLabel(ch),
      color: isSub ? '#D500F9' : CREATION_PAD_COLORS[ch - 1] ?? '#888888',
      trackType: 'Drum',
    });
  }
  readCreationChannelManifestFromStorage().forEach((v, k) => {
    if (k >= 1 && k <= 17 && v.name) {
      combined.set(k, { name: v.name, color: v.color || '#888888', trackType: 'Drum' });
    }
  });

  // ── Baseline AI Pattern lanes (default 8, expands with `getAiPatternLaneCountEffective()`)
  const aiLaneCount = getAiPatternLaneCountEffective();
  for (let i = 0; i < aiLaneCount; i++) {
    const slot = AI_PATTERN_SESSION_BASE + i;
    combined.set(slot, {
      name: `AI: Pattern ${i + 1}`,
      color: NOTE_COLORS_AI[i % NOTE_COLORS_AI.length],
      trackType: 'MIDI',
    });
  }
  readAiPatternSessionManifestFromStorage().forEach((v, k) => {
    if (k >= AI_PATTERN_SESSION_BASE) {
      combined.set(k, {
        name: v.name || `AI: Pattern ${k - AI_PATTERN_SESSION_BASE + 1}`,
        color: v.color || '#888888',
        trackType: v.trackType || 'MIDI',
      });
    }
  });

  // ── Master Arranger: persisted absolute `audioTrack` (written with `getMasterArrangerSessionBase()` + id − 1)
  readMasterArrangerSessionManifestFromStorage().forEach((v, k) => combined.set(k, v));

  return combined;
}

/** Single read API for modules — same master list Studio merges (by `audioTrack` / channel slot). */
export function getSessionTrackMeta(audioTrack: number): SessionTrackMeta | undefined {
  return readCombinedSessionTrackManifest().get(audioTrack);
}
