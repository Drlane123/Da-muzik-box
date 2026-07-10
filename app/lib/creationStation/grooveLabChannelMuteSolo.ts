/**
 * Groove Lab CH 33–48 mute / solo — faders unchanged; gain path reads window + storage.
 */
import {
  CHORD_BASS_SEQ_CHANNEL_BASE,
  CHORD_BASS_SEQ_CHANNEL_COUNT,
} from '@/app/lib/creationStation/chordBassSequencerSession';

const MUTE_STORAGE_KEY = 'groove-lab-channel-mutes-v1';
const SOLO_STORAGE_KEY = 'groove-lab-channel-solos-v1';

export const GROOVE_LAB_CHANNEL_MS_CHANGED = 'da-groove-lab-channel-ms-changed';

type MsGlobals = {
  __daMusicGrooveChannelMutes?: Record<number, boolean>;
  __daMusicGrooveChannelSolos?: Record<number, boolean>;
};

function msWindow(): MsGlobals {
  return globalThis as unknown as MsGlobals;
}

function channelRange(): number[] {
  return Array.from(
    { length: CHORD_BASS_SEQ_CHANNEL_COUNT },
    (_, i) => CHORD_BASS_SEQ_CHANNEL_BASE + i,
  );
}

function readBoolMap(storageKey: string): Record<number, boolean> {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(storageKey) : null;
    if (!raw) return {};
    const obj = JSON.parse(raw) as Record<string, unknown>;
    const out: Record<number, boolean> = {};
    for (const ch of channelRange()) {
      if (obj[String(ch)] === true) out[ch] = true;
    }
    return out;
  } catch {
    return {};
  }
}

function writeBoolMap(storageKey: string, map: Record<number, boolean>): void {
  try {
    const flat: Record<string, boolean> = {};
    for (const ch of channelRange()) {
      if (map[ch]) flat[String(ch)] = true;
    }
    localStorage.setItem(storageKey, JSON.stringify(flat));
  } catch {
    /* quota / privacy mode */
  }
}

function ensureMuteMap(): Record<number, boolean> {
  const w = msWindow();
  if (!w.__daMusicGrooveChannelMutes) {
    w.__daMusicGrooveChannelMutes = { ...readBoolMap(MUTE_STORAGE_KEY) };
  }
  return w.__daMusicGrooveChannelMutes;
}

function ensureSoloMap(): Record<number, boolean> {
  const w = msWindow();
  if (!w.__daMusicGrooveChannelSolos) {
    w.__daMusicGrooveChannelSolos = { ...readBoolMap(SOLO_STORAGE_KEY) };
  }
  return w.__daMusicGrooveChannelSolos;
}

function notifyMsChanged(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(GROOVE_LAB_CHANNEL_MS_CHANGED));
}

export function readGrooveLabChannelMutes(): Record<number, boolean> {
  return { ...ensureMuteMap() };
}

export function readGrooveLabChannelSolos(): Record<number, boolean> {
  return { ...ensureSoloMap() };
}

export function isGrooveLabChannelMuted(ch: number): boolean {
  return ensureMuteMap()[ch] === true;
}

export function isGrooveLabChannelSolo(ch: number): boolean {
  return ensureSoloMap()[ch] === true;
}

export function grooveLabAnyChannelSolo(): boolean {
  return Object.values(ensureSoloMap()).some(Boolean);
}

/** True when this channel should pass audio (mute/solo law — fader level unchanged). */
export function grooveLabChannelAudible(ch: number): boolean {
  const muted = isGrooveLabChannelMuted(ch);
  if (muted) return false;
  const anySolo = grooveLabAnyChannelSolo();
  if (!anySolo) return true;
  return isGrooveLabChannelSolo(ch);
}

export function toggleGrooveLabChannelMute(ch: number): boolean {
  const map = ensureMuteMap();
  const next = !map[ch];
  if (next) map[ch] = true;
  else delete map[ch];
  writeBoolMap(MUTE_STORAGE_KEY, map);
  notifyMsChanged();
  return next;
}

export function toggleGrooveLabChannelSolo(ch: number): boolean {
  const map = ensureSoloMap();
  const next = !map[ch];
  if (next) map[ch] = true;
  else delete map[ch];
  writeBoolMap(SOLO_STORAGE_KEY, map);
  notifyMsChanged();
  return next;
}

export function clearGrooveLabChannelMute(ch: number): void {
  const map = ensureMuteMap();
  if (!map[ch]) return;
  delete map[ch];
  writeBoolMap(MUTE_STORAGE_KEY, map);
  notifyMsChanged();
}

export function clearAllGrooveLabChannelSolos(): void {
  const map = ensureSoloMap();
  if (!Object.values(map).some(Boolean)) return;
  for (const ch of channelRange()) delete map[ch];
  writeBoolMap(SOLO_STORAGE_KEY, map);
  notifyMsChanged();
}

/** One-shot repair — stuck solo/mute on layer lanes silences everything except guitar. */
export function repairGrooveLabLayerMuteSolo(layerChannels: readonly number[]): void {
  clearAllGrooveLabChannelSolos();
  for (const ch of layerChannels) clearGrooveLabChannelMute(ch);
}
