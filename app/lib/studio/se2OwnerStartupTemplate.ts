/**
 * Owner-defined SE2 startup layout — survives factory version bumps and reloads.
 * Applied on every cold open before SE2 reads session state.
 */
import {
  normalizeSe2SessionTracks,
  SE2_SESSION_STORAGE_KEY,
  type Se2SessionFileV1,
  type Se2SessionWritePayload,
  writeSe2SessionSnapshot,
} from '@/app/lib/studio/se2SessionPersistence';
import {
  readSe2StudioMixerSnapshot,
  type Se2StudioMixerSnapshot,
  writeSe2StudioMixerSnapshot,
} from '@/app/lib/studio/se2StudioMixerState';
import {
  getSe2BeatPadsMainVolume,
  setSe2BeatPadsMainVolume,
} from '@/app/lib/studio/se2BeatPadsMainVolume';

export const SE2_OWNER_STARTUP_STORAGE_KEY = 'dmb_se2_owner_startup_v1';
export const SE2_PIANO_SNAP_SUBDIV_KEY = 'dmb_shared_piano_snap_subdiv';

/** On-screen view layout captured with the template (which panel is showing). */
export type Se2OwnerStartupView = {
  showMixer: boolean;
  showPianoRoll: boolean;
};

export type Se2OwnerStartupBundleV1 = {
  version: 1;
  savedAt: string;
  /** Optional display name shown in the save-template dialog. */
  templateLabel?: string;
  session: Se2SessionFileV1;
  mixer: Se2StudioMixerSnapshot | null;
  pianoSnapSubdiv: string;
  view: Se2OwnerStartupView | null;
  /** Beat Pads dock Vol (0…1) — own level, not mixer master. */
  beatPadsMainVolume?: number;
};

function parseOwnerView(raw: unknown): Se2OwnerStartupView | null {
  if (!raw || typeof raw !== 'object') return null;
  const v = raw as Partial<Se2OwnerStartupView>;
  return {
    showMixer: v.showMixer === true,
    showPianoRoll: v.showPianoRoll === true,
  };
}

function parseOwnerBundle(raw: string | null): Se2OwnerStartupBundleV1 | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Se2OwnerStartupBundleV1;
    if (!parsed || parsed.version !== 1 || !parsed.session) return null;
    const session = parsed.session;
    if (session.version !== 1 || !Array.isArray(session.tracks)) return null;
    const beatPadsMainVolume =
      typeof parsed.beatPadsMainVolume === 'number' && Number.isFinite(parsed.beatPadsMainVolume)
        ? Math.max(0, Math.min(1, parsed.beatPadsMainVolume))
        : undefined;
    return {
      version: 1,
      savedAt: typeof parsed.savedAt === 'string' ? parsed.savedAt : new Date().toISOString(),
      templateLabel:
        typeof parsed.templateLabel === 'string' && parsed.templateLabel.trim()
          ? parsed.templateLabel.trim()
          : undefined,
      session: { ...session, tracks: normalizeSe2SessionTracks(session.tracks) },
      mixer: parsed.mixer ?? null,
      pianoSnapSubdiv:
        typeof parsed.pianoSnapSubdiv === 'string' && parsed.pianoSnapSubdiv
          ? parsed.pianoSnapSubdiv
          : '4',
      view: parseOwnerView(parsed.view),
      beatPadsMainVolume,
    };
  } catch {
    return null;
  }
}

export function hasSe2OwnerStartupTemplate(): boolean {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem(SE2_OWNER_STARTUP_STORAGE_KEY) != null;
  } catch {
    return false;
  }
}

export function readSe2OwnerStartupTemplate(): Se2OwnerStartupBundleV1 | null {
  try {
    const raw =
      typeof localStorage !== 'undefined' ? localStorage.getItem(SE2_OWNER_STARTUP_STORAGE_KEY) : null;
    return parseOwnerBundle(raw);
  } catch {
    return null;
  }
}

export function writeSe2OwnerStartupTemplate(bundle: Omit<Se2OwnerStartupBundleV1, 'version' | 'savedAt'>): void {
  try {
    const beatPadsMainVolume =
      typeof bundle.beatPadsMainVolume === 'number' && Number.isFinite(bundle.beatPadsMainVolume)
        ? Math.max(0, Math.min(1, bundle.beatPadsMainVolume))
        : getSe2BeatPadsMainVolume();
    const file: Se2OwnerStartupBundleV1 = {
      version: 1,
      savedAt: new Date().toISOString(),
      templateLabel:
        typeof bundle.templateLabel === 'string' && bundle.templateLabel.trim()
          ? bundle.templateLabel.trim()
          : undefined,
      session: {
        version: 1,
        savedAt: new Date().toISOString(),
        ...bundle.session,
        tracks: normalizeSe2SessionTracks(bundle.session.tracks),
      },
      mixer: bundle.mixer,
      pianoSnapSubdiv: bundle.pianoSnapSubdiv || '4',
      view: bundle.view ?? null,
      beatPadsMainVolume,
    };
    localStorage.setItem(SE2_OWNER_STARTUP_STORAGE_KEY, JSON.stringify(file));
  } catch (err) {
    console.warn('SE2: owner startup template save failed', err);
  }
}

/** Write owner template from a live session payload (tracks, transport, audio, mixer, view). */
export function captureSe2OwnerStartupTemplate(
  payload: Se2SessionWritePayload,
  mixer: Se2StudioMixerSnapshot | null,
  view: Se2OwnerStartupView | null = null,
  templateLabel?: string,
): void {
  const pianoSnapSubdiv =
    (typeof localStorage !== 'undefined' && localStorage.getItem(SE2_PIANO_SNAP_SUBDIV_KEY)) || '4';
  const label =
    typeof templateLabel === 'string' && templateLabel.trim() ? templateLabel.trim() : undefined;
  writeSe2OwnerStartupTemplate({
    session: { version: 1, savedAt: new Date().toISOString(), ...payload },
    mixer,
    pianoSnapSubdiv,
    view,
    beatPadsMainVolume: getSe2BeatPadsMainVolume(),
    templateLabel: label,
  });
}

/** Save current Beat Pads Vol into the owner template (patch or bootstrap from live session). */
export function saveSe2OwnerStartupBeatPadsMainVolume(): boolean {
  const vol = getSe2BeatPadsMainVolume();
  const existing = readSe2OwnerStartupTemplate();
  if (existing) {
    writeSe2OwnerStartupTemplate({
      session: existing.session,
      mixer: existing.mixer,
      pianoSnapSubdiv: existing.pianoSnapSubdiv,
      view: existing.view,
      beatPadsMainVolume: vol,
      templateLabel: existing.templateLabel,
    });
    return true;
  }
  try {
    const sessionRaw =
      typeof localStorage !== 'undefined' ? localStorage.getItem(SE2_SESSION_STORAGE_KEY) : null;
    if (!sessionRaw) return false;
    const session = JSON.parse(sessionRaw) as Se2SessionFileV1;
    if (!session || !Array.isArray(session.tracks) || session.tracks.length === 0) return false;
    writeSe2OwnerStartupTemplate({
      session: { ...session, tracks: normalizeSe2SessionTracks(session.tracks) },
      mixer: readSe2StudioMixerSnapshot(),
      pianoSnapSubdiv:
        (typeof localStorage !== 'undefined' && localStorage.getItem(SE2_PIANO_SNAP_SUBDIV_KEY)) || '4',
      view: null,
      beatPadsMainVolume: vol,
    });
    return true;
  } catch {
    return false;
  }
}

/** Read just the saved on-screen view layout (which panel was showing). */
export function readSe2OwnerStartupView(): Se2OwnerStartupView | null {
  return readSe2OwnerStartupTemplate()?.view ?? null;
}

/** If the user already has tracks in session but no owner template, preserve that layout once. */
export function maybeCaptureExistingSessionAsOwnerStartup(): void {
  if (hasSe2OwnerStartupTemplate()) return;
  try {
    const sessionRaw =
      typeof localStorage !== 'undefined' ? localStorage.getItem(SE2_SESSION_STORAGE_KEY) : null;
    if (!sessionRaw) return;
    const session = JSON.parse(sessionRaw) as Se2SessionFileV1;
    if (!session || !Array.isArray(session.tracks) || session.tracks.length === 0) return;
    const tracks = normalizeSe2SessionTracks(session.tracks);
    if (!tracks.length) return;
    captureSe2OwnerStartupTemplate({ ...session, tracks }, readSe2StudioMixerSnapshot());
  } catch {
    /* ignore */
  }
}

/** Push owner startup into active session keys so SE2 boot reads the saved layout. */
export function applySe2OwnerStartupTemplateToSession(): boolean {
  const owner = readSe2OwnerStartupTemplate();
  if (!owner) return false;
  try {
    writeSe2SessionSnapshot({
      tracks: owner.session.tracks,
      selectedTrackIndex: owner.session.selectedTrackIndex,
      bpm: owner.session.bpm,
      loopOn: owner.session.loopOn,
      loopBars: owner.session.loopBars,
      loopStartBeat: owner.session.loopStartBeat,
      loopEndBeat: owner.session.loopEndBeat,
      beatsPerBar: owner.session.beatsPerBar,
      beatPadsMachineOpen: owner.session.beatPadsMachineOpen,
      songKeyRoot: owner.session.songKeyRoot,
      songKeyMode: owner.session.songKeyMode,
      timelineZoom: owner.session.timelineZoom,
      audioSources: owner.session.audioSources,
    });
    if (owner.mixer) {
      writeSe2StudioMixerSnapshot(owner.mixer);
    }
    if (owner.pianoSnapSubdiv) {
      localStorage.setItem(SE2_PIANO_SNAP_SUBDIV_KEY, owner.pianoSnapSubdiv);
    }
    if (typeof owner.beatPadsMainVolume === 'number' && Number.isFinite(owner.beatPadsMainVolume)) {
      setSe2BeatPadsMainVolume(owner.beatPadsMainVolume);
    }
    return true;
  } catch {
    return false;
  }
}

export function clearSe2OwnerStartupTemplate(): void {
  try {
    localStorage.removeItem(SE2_OWNER_STARTUP_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
