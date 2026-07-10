/**
 * 808 Lab BPM / transport sync — kick/bass + drum kits (same page) and optional follow
 * Beat Lab, Groove Lab, or Chord Builder tempo.
 */
import { readChordSync } from '@/app/lib/chordBuilderSync';

export type Lab808BpmSyncTarget = '808-internal' | 'beat-lab' | 'groove-lab' | 'chord-builder';

export type Lab808TransportMirrorTarget = 'none' | 'beat-lab' | 'groove-lab';

export const LAB808_BPM_SYNC_TARGET_STORAGE = 'da_808_bpm_sync_target_v1';
export const LAB808_INTERNAL_LINK_STORAGE = 'da_808_internal_link_v1';
export const LAB808_TRANSPORT_MIRROR_STORAGE = 'da_808_transport_mirror_v1';
export const LAB808_SYNC_CHANGED_EVENT = 'da-808-sync-changed';

export type Lab808TransportMirrorAction = 'play' | 'pause' | 'stop';

export const LAB808_TRANSPORT_MIRROR_EVENT = 'da-808-transport-mirror';

/** Groove Lab PLAY → 808 Lab when 808 pad-deck PLAY → Groove Lab is linked. */
export const GROOVE_LAB_TRANSPORT_MIRROR_EVENT = 'da-groove-lab-transport-mirror';

/** Creation Station shortcuts — local Groove Lab transport (not Beat Lab). */
export const GROOVE_LAB_LOCAL_TRANSPORT_EVENT = 'da-groove-lab-local-transport';

export type GrooveLabLocalTransportDetail = {
  action: Lab808TransportMirrorAction;
};

export type Lab808TransportMirrorDetail = {
  action: Lab808TransportMirrorAction;
  target: Lab808TransportMirrorTarget;
};

export type GrooveLabTransportMirrorDetail = {
  action: Lab808TransportMirrorAction;
};

const CREATION_SESSION_LINK_STORAGE = 'da-creation-session-link-v1';

function readSession808PlayLinked(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const raw = window.localStorage.getItem(CREATION_SESSION_LINK_STORAGE);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as { playLinked?: Record<string, boolean> };
    return parsed?.playLinked?.['808-lab'] === true;
  } catch {
    return false;
  }
}

/** Pad-deck PLAY → Groove Lab or Session Link Sync on 808 while using Groove Lab. */
export function shouldMirror808FromGrooveLab(): boolean {
  return readLab808TransportMirror() === 'groove-lab' || readSession808PlayLinked();
}

export function isLab808GrooveTransportLinked(): boolean {
  return shouldMirror808FromGrooveLab();
}

export const LAB808_BPM_SYNC_TARGET_LABELS: Record<Lab808BpmSyncTarget, string> = {
  '808-internal': '808 only',
  'beat-lab': 'Beat Lab',
  'groove-lab': 'Groove Lab',
  'chord-builder': 'Chord Builder',
};

export function readLab808BpmSyncTarget(): Lab808BpmSyncTarget {
  if (typeof window === 'undefined') return '808-internal';
  try {
    const raw = window.localStorage.getItem(LAB808_BPM_SYNC_TARGET_STORAGE);
    if (
      raw === 'beat-lab' ||
      raw === 'groove-lab' ||
      raw === 'chord-builder' ||
      raw === '808-internal'
    ) {
      return raw;
    }
  } catch {
    /* ignore */
  }
  return '808-internal';
}

export function storeLab808BpmSyncTarget(target: Lab808BpmSyncTarget): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LAB808_BPM_SYNC_TARGET_STORAGE, target);
  } catch {
    /* quota */
  }
  notifyLab808SyncChanged();
}

export function readLab808InternalLink(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const raw = window.localStorage.getItem(LAB808_INTERNAL_LINK_STORAGE);
    if (raw === '0' || raw === 'false') return false;
  } catch {
    /* ignore */
  }
  return true;
}

export function storeLab808InternalLink(linked: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LAB808_INTERNAL_LINK_STORAGE, linked ? '1' : '0');
  } catch {
    /* quota */
  }
  notifyLab808SyncChanged();
}

export function readLab808TransportMirror(): Lab808TransportMirrorTarget {
  if (typeof window === 'undefined') return 'none';
  try {
    const raw = window.localStorage.getItem(LAB808_TRANSPORT_MIRROR_STORAGE);
    if (raw === 'beat-lab' || raw === 'groove-lab' || raw === 'none') return raw;
  } catch {
    /* ignore */
  }
  return 'none';
}

export function storeLab808TransportMirror(target: Lab808TransportMirrorTarget): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LAB808_TRANSPORT_MIRROR_STORAGE, target);
  } catch {
    /* quota */
  }
  notifyLab808SyncChanged();
}

export function notifyLab808SyncChanged(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(LAB808_SYNC_CHANGED_EVENT));
}

export function dispatchLab808TransportMirror(
  action: Lab808TransportMirrorAction,
  target: Lab808TransportMirrorTarget,
): void {
  if (typeof window === 'undefined' || target === 'none') return;
  window.dispatchEvent(
    new CustomEvent<Lab808TransportMirrorDetail>(LAB808_TRANSPORT_MIRROR_EVENT, {
      detail: { action, target },
    }),
  );
}

/** Mirror Groove Lab transport to 808 Lab MPC/roll (pad-deck link or Session Link Sync on 808). */
export function dispatchGrooveLabTransportMirror(action: Lab808TransportMirrorAction): void {
  if (typeof window === 'undefined' || !shouldMirror808FromGrooveLab()) return;
  window.dispatchEvent(
    new CustomEvent<GrooveLabTransportMirrorDetail>(GROOVE_LAB_TRANSPORT_MIRROR_EVENT, {
      detail: { action },
    }),
  );
}

/** Groove Lab tab transport + Creation Station shortcuts while Groove is active. */
export function dispatchGrooveLabLocalTransport(action: Lab808TransportMirrorAction): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent<GrooveLabLocalTransportDetail>(GROOVE_LAB_LOCAL_TRANSPORT_EVENT, {
      detail: { action },
    }),
  );
}

export function resolveLab808SyncBpm(args: {
  target: Lab808BpmSyncTarget;
  beatLabBpm: number;
  grooveLabBpm?: number;
  fallbackBpm: number;
}): number {
  const clamp = (n: number) => Math.max(40, Math.min(220, Math.round(n)));
  switch (args.target) {
    case 'beat-lab':
      return clamp(args.beatLabBpm);
    case 'groove-lab':
      return clamp(args.grooveLabBpm ?? args.beatLabBpm);
    case 'chord-builder': {
      const sync = readChordSync();
      if (sync?.bpm != null && Number.isFinite(sync.bpm)) return clamp(sync.bpm);
      return clamp(args.fallbackBpm);
    }
    case '808-internal':
    default:
      return clamp(args.fallbackBpm);
  }
}
