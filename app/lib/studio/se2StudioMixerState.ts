/**
 * Studio Editor 2 mixer — session state isolated from Groove Lab / Beat Lab mixers.
 * Persists per-track fader/pan/mute (keyed by track id), not MasterClock CH 1–48.
 */
import { MIXER_UNITY_VOL } from '@/app/lib/studio/se2MixerFaderScale';

export const SE2_STUDIO_MIXER_STORAGE_KEY = 'se2-studio-mixer-v1';

/** Default master fader (matches SE2 transport cluster). */
export const SE2_STUDIO_DEFAULT_MASTER_VOL = 83;

export type Se2StudioMixerTrackSnapshot = {
  id: string;
  vol127: number;
  pan127: number;
  muted: boolean;
  solo: boolean;
  mono: boolean;
};

export type Se2StudioMixerSnapshot = {
  masterVol127: number;
  tracks: Se2StudioMixerTrackSnapshot[];
};

export const SE2_STUDIO_MIXER_TRACK_DEFAULTS: {
  vol127: number;
  pan127: number;
  muted: boolean;
  solo: boolean;
  mono: boolean;
} = {
  vol127: MIXER_UNITY_VOL,
  pan127: 64,
  muted: false,
  solo: false,
  mono: false,
};

export function readSe2StudioMixerSnapshot(): Se2StudioMixerSnapshot | null {
  try {
    const raw =
      typeof localStorage !== 'undefined'
        ? localStorage.getItem(SE2_STUDIO_MIXER_STORAGE_KEY)
        : null;
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Se2StudioMixerSnapshot;
    if (!parsed || !Array.isArray(parsed.tracks)) return null;
    return {
      masterVol127:
        typeof parsed.masterVol127 === 'number' && Number.isFinite(parsed.masterVol127)
          ? Math.max(0, Math.min(127, Math.round(parsed.masterVol127)))
          : SE2_STUDIO_DEFAULT_MASTER_VOL,
      tracks: parsed.tracks
        .filter((t) => t && typeof t.id === 'string')
        .map((t) => ({
          id: t.id,
          vol127:
            typeof t.vol127 === 'number'
              ? Math.max(0, Math.min(127, Math.round(t.vol127)))
              : SE2_STUDIO_MIXER_TRACK_DEFAULTS.vol127,
          pan127:
            typeof t.pan127 === 'number'
              ? Math.max(0, Math.min(127, Math.round(t.pan127)))
              : SE2_STUDIO_MIXER_TRACK_DEFAULTS.pan127,
          muted: Boolean(t.muted),
          solo: Boolean(t.solo),
          mono: Boolean(t.mono),
        })),
    };
  } catch {
    return null;
  }
}

export function writeSe2StudioMixerSnapshot(snap: Se2StudioMixerSnapshot): void {
  try {
    localStorage.setItem(SE2_STUDIO_MIXER_STORAGE_KEY, JSON.stringify(snap));
  } catch {
    /* quota / privacy mode */
  }
}

export function buildSe2MixerArraysFromSnapshot(
  tracks: readonly { id: string }[],
  snap: Se2StudioMixerSnapshot | null,
  maxTracks: number,
): {
  volumes: number[];
  pans: number[];
  mutes: boolean[];
  solos: boolean[];
  monos: boolean[];
  masterVol127: number;
} {
  const byId = new Map((snap?.tracks ?? []).map((t) => [t.id, t]));
  const volumes = Array.from({ length: maxTracks }, () => SE2_STUDIO_MIXER_TRACK_DEFAULTS.vol127);
  const pans = Array.from({ length: maxTracks }, () => SE2_STUDIO_MIXER_TRACK_DEFAULTS.pan127);
  const mutes = Array.from({ length: maxTracks }, () => SE2_STUDIO_MIXER_TRACK_DEFAULTS.muted);
  const solos = Array.from({ length: maxTracks }, () => SE2_STUDIO_MIXER_TRACK_DEFAULTS.solo);
  const monos = Array.from({ length: maxTracks }, () => SE2_STUDIO_MIXER_TRACK_DEFAULTS.mono);
  for (let i = 0; i < tracks.length && i < maxTracks; i += 1) {
    const saved = byId.get(tracks[i]!.id);
    if (!saved) continue;
    volumes[i] = se2RepairMixerVol127(saved.vol127);
    pans[i] = saved.pan127;
    mutes[i] = saved.muted;
    solos[i] = saved.solo;
    monos[i] = saved.mono;
  }
  return {
    volumes,
    pans,
    mutes,
    solos,
    monos,
    masterVol127: se2RepairMixerVol127(
      snap?.masterVol127 ?? SE2_STUDIO_DEFAULT_MASTER_VOL,
    ),
  };
}

/** Repair corrupt persisted faders (0 / NaN) that silence strips. */
export function se2RepairMixerVol127(vol127: number): number {
  if (!Number.isFinite(vol127) || vol127 <= 0) return MIXER_UNITY_VOL;
  return Math.max(0, Math.min(127, Math.round(vol127)));
}

/** Solo-in-place: when any solo is on, non-solo lanes are effectively muted. */
export function se2EffectiveTrackMuted(
  trackIndex: number,
  mutes: readonly boolean[],
  solos: readonly boolean[],
): boolean {
  if (mutes[trackIndex]) return true;
  const anySolo = solos.some(Boolean);
  if (!anySolo) return false;
  return !(solos[trackIndex] ?? false);
}

export function snapshotSe2MixerFromArrays(
  tracks: readonly { id: string }[],
  volumes: readonly number[],
  pans: readonly number[],
  mutes: readonly boolean[],
  solos: readonly boolean[],
  monos: readonly boolean[],
  masterVol127: number,
): Se2StudioMixerSnapshot {
  const trackSnaps: Se2StudioMixerTrackSnapshot[] = [];
  for (let i = 0; i < tracks.length; i += 1) {
    const tr = tracks[i]!;
    trackSnaps.push({
      id: tr.id,
      vol127: volumes[i] ?? SE2_STUDIO_MIXER_TRACK_DEFAULTS.vol127,
      pan127: pans[i] ?? SE2_STUDIO_MIXER_TRACK_DEFAULTS.pan127,
      muted: mutes[i] ?? false,
      solo: solos[i] ?? false,
      mono: monos[i] ?? false,
    });
  }
  return {
    masterVol127: Math.max(0, Math.min(127, Math.round(masterVol127))),
    tracks: trackSnaps,
  };
}
