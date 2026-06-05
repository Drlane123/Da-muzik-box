/**
 * Creation Station — Beat Lab session BPM + optional play mirroring.
 * BPM link: module follows Beat Lab tempo only (independent playheads OK).
 * Play link: Beat Lab transport also starts/stops that module's transport.
 */

import type { Lab808TransportMirrorAction } from '@/app/lib/creationStation/lab808Sync';

export type CreationSessionLinkModuleId = 'new-synth' | 'groove-lab' | '808-lab' | 'chord-builder';

export type CreationSessionLinkState = {
  bpmLinked: Record<CreationSessionLinkModuleId, boolean>;
  playLinked: Record<CreationSessionLinkModuleId, boolean>;
};

export const CREATION_SESSION_LINK_STORAGE = 'da-creation-session-link-v1';
export const CREATION_SESSION_LINK_CHANGED = 'da-creation-session-link-changed';

/** Beat Lab → linked module transport (Groove / 808 listen when play-linked). */
export const CREATION_BEATLAB_PLAY_MIRROR_EVENT = 'da-beatlab-play-mirror';

export type CreationBeatlabPlayMirrorTarget = 'groove-lab' | '808-lab' | 'chord-builder';

export type CreationBeatlabPlayMirrorDetail = {
  action: Lab808TransportMirrorAction;
  target: CreationBeatlabPlayMirrorTarget;
};

export const CREATION_SESSION_MODULE_LABELS: Record<CreationSessionLinkModuleId, string> = {
  'new-synth': 'New Synth',
  'groove-lab': 'Groove Lab',
  '808-lab': '808 Lab',
  'chord-builder': 'Chord Builder',
};

const DEFAULT_STATE: CreationSessionLinkState = {
  bpmLinked: {
    'new-synth': true,
    'groove-lab': true,
    '808-lab': false,
    'chord-builder': false,
  },
  playLinked: {
    'new-synth': false,
    'groove-lab': true,
    '808-lab': false,
    'chord-builder': false,
  },
};

function normalizeBoolRecord(
  raw: unknown,
  fallback: Record<CreationSessionLinkModuleId, boolean>,
): Record<CreationSessionLinkModuleId, boolean> {
  const out = { ...fallback };
  if (!raw || typeof raw !== 'object') return out;
  for (const id of Object.keys(fallback) as CreationSessionLinkModuleId[]) {
    const v = (raw as Record<string, unknown>)[id];
    if (typeof v === 'boolean') out[id] = v;
  }
  return out;
}

export function readCreationSessionLink(): CreationSessionLinkState {
  if (typeof window === 'undefined') return { ...DEFAULT_STATE, bpmLinked: { ...DEFAULT_STATE.bpmLinked }, playLinked: { ...DEFAULT_STATE.playLinked } };
  try {
    const raw = window.localStorage.getItem(CREATION_SESSION_LINK_STORAGE);
    if (!raw) return cloneDefaultState();
    const parsed = JSON.parse(raw) as Partial<CreationSessionLinkState>;
    return {
      bpmLinked: normalizeBoolRecord(parsed.bpmLinked, DEFAULT_STATE.bpmLinked),
      playLinked: normalizeBoolRecord(parsed.playLinked, DEFAULT_STATE.playLinked),
    };
  } catch {
    return cloneDefaultState();
  }
}

function cloneDefaultState(): CreationSessionLinkState {
  return {
    bpmLinked: { ...DEFAULT_STATE.bpmLinked },
    playLinked: { ...DEFAULT_STATE.playLinked },
  };
}

export function storeCreationSessionLink(state: CreationSessionLinkState): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(CREATION_SESSION_LINK_STORAGE, JSON.stringify(state));
  } catch {
    /* quota */
  }
  notifyCreationSessionLinkChanged();
}

export function notifyCreationSessionLinkChanged(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(CREATION_SESSION_LINK_CHANGED));
}

export function toggleCreationSessionBpmLink(
  state: CreationSessionLinkState,
  moduleId: CreationSessionLinkModuleId,
): CreationSessionLinkState {
  return {
    ...state,
    bpmLinked: { ...state.bpmLinked, [moduleId]: !state.bpmLinked[moduleId] },
  };
}

export function toggleCreationSessionPlayLink(
  state: CreationSessionLinkState,
  moduleId: CreationSessionLinkModuleId,
): CreationSessionLinkState {
  return {
    ...state,
    playLinked: { ...state.playLinked, [moduleId]: !state.playLinked[moduleId] },
  };
}

/** Groove Lab (or Beat Lab) → 808 Lab transport when Session Link Sync is on for 808 Lab. */
export function dispatchCreation808PlayMirror(action: Lab808TransportMirrorAction): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent<CreationBeatlabPlayMirrorDetail>(CREATION_BEATLAB_PLAY_MIRROR_EVENT, {
      detail: { action, target: '808-lab' },
    }),
  );
}

export function dispatchCreationSessionPlayMirror(
  action: Lab808TransportMirrorAction,
  state: CreationSessionLinkState,
): void {
  if (typeof window === 'undefined') return;
  if (state.playLinked['groove-lab']) {
    window.dispatchEvent(
      new CustomEvent<CreationBeatlabPlayMirrorDetail>(CREATION_BEATLAB_PLAY_MIRROR_EVENT, {
        detail: { action, target: 'groove-lab' },
      }),
    );
  }
  if (state.playLinked['808-lab']) {
    window.dispatchEvent(
      new CustomEvent<CreationBeatlabPlayMirrorDetail>(CREATION_BEATLAB_PLAY_MIRROR_EVENT, {
        detail: { action, target: '808-lab' },
      }),
    );
  }
  if (state.playLinked['chord-builder']) {
    window.dispatchEvent(
      new CustomEvent<CreationBeatlabPlayMirrorDetail>(CREATION_BEATLAB_PLAY_MIRROR_EVENT, {
        detail: { action, target: 'chord-builder' },
      }),
    );
  }
}
