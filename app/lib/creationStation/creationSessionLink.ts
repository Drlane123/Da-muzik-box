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

/** Groove Lab PLAY → Beat Lab (reverse of Session Link Sync — optional toggle on Groove tab). */
export const GROOVE_LAB_BEATLAB_MIRROR_STORAGE = 'da-groove-lab-beatlab-mirror-v1';
export const GROOVE_LAB_BEATLAB_MIRROR_CHANGED = 'da-groove-beatlab-mirror-changed';
export const GROOVE_LAB_BEATLAB_MIRROR_EVENT = 'da-groove-lab-beatlab-mirror';

export type GrooveLabBeatlabMirrorDetail = {
  action: Lab808TransportMirrorAction;
};

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
    'groove-lab': false,
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

/** Mirror play only to play-linked modules that are mounted (hidden mount on Beat Lab tab). */
export type CreationSessionPlayMirrorVisibility = {
  grooveLab?: boolean;
  eightOhEight?: boolean;
  chordBuilder?: boolean;
};

export function readGrooveLabBeatlabPlayMirror(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(GROOVE_LAB_BEATLAB_MIRROR_STORAGE) === '1';
  } catch {
    return false;
  }
}

export function storeGrooveLabBeatlabPlayMirror(on: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(GROOVE_LAB_BEATLAB_MIRROR_STORAGE, on ? '1' : '0');
  } catch {
    /* quota */
  }
  window.dispatchEvent(new CustomEvent(GROOVE_LAB_BEATLAB_MIRROR_CHANGED));
}

/** Groove Lab transport → Beat Lab grid when Groove tab BeatLab toggle is on. */
export function dispatchGrooveLabBeatlabPlayMirror(action: Lab808TransportMirrorAction): void {
  if (typeof window === 'undefined' || !readGrooveLabBeatlabPlayMirror()) return;
  window.dispatchEvent(
    new CustomEvent<GrooveLabBeatlabMirrorDetail>(GROOVE_LAB_BEATLAB_MIRROR_EVENT, {
      detail: { action },
    }),
  );
}

export function dispatchCreationSessionPlayMirror(
  action: Lab808TransportMirrorAction,
  state: CreationSessionLinkState,
  visible: CreationSessionPlayMirrorVisibility = {},
): void {
  if (typeof window === 'undefined') return;
  if (state.playLinked['groove-lab'] && (visible.grooveLab ?? false)) {
    window.dispatchEvent(
      new CustomEvent<CreationBeatlabPlayMirrorDetail>(CREATION_BEATLAB_PLAY_MIRROR_EVENT, {
        detail: { action, target: 'groove-lab' },
      }),
    );
  }
  if (state.playLinked['808-lab'] && (visible.eightOhEight ?? false)) {
    window.dispatchEvent(
      new CustomEvent<CreationBeatlabPlayMirrorDetail>(CREATION_BEATLAB_PLAY_MIRROR_EVENT, {
        detail: { action, target: '808-lab' },
      }),
    );
  }
  if (state.playLinked['chord-builder'] && (visible.chordBuilder ?? false)) {
    window.dispatchEvent(
      new CustomEvent<CreationBeatlabPlayMirrorDetail>(CREATION_BEATLAB_PLAY_MIRROR_EVENT, {
        detail: { action, target: 'chord-builder' },
      }),
    );
  }
}
