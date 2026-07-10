import type { Se2ChordGenieAiMidiProvider } from '@/app/lib/studio/se2ChordGenieAiMidi';

const STORAGE_PREFIX = 'se2-midi-composer';

function storageKey(suffix: string): string {
  return `${STORAGE_PREFIX}:${suffix}`;
}

export function readSe2MidiComposerApiKey(provider: Se2ChordGenieAiMidiProvider): string {
  if (typeof localStorage === 'undefined') return '';
  try {
    return localStorage.getItem(storageKey(`api-key:${provider}`)) ?? '';
  } catch {
    return '';
  }
}

export function writeSe2MidiComposerApiKey(provider: Se2ChordGenieAiMidiProvider, key: string): void {
  if (typeof localStorage === 'undefined') return;
  try {
    const trimmed = key.trim();
    const id = storageKey(`api-key:${provider}`);
    if (trimmed) localStorage.setItem(id, trimmed);
    else localStorage.removeItem(id);
  } catch {
    /* ignore quota */
  }
}

export function readSe2MidiComposerCustomEndpoint(): string {
  if (typeof localStorage === 'undefined') return '';
  try {
    return localStorage.getItem(storageKey('custom-endpoint')) ?? '';
  } catch {
    return '';
  }
}

export function writeSe2MidiComposerCustomEndpoint(url: string): void {
  if (typeof localStorage === 'undefined') return;
  try {
    const trimmed = url.trim();
    const id = storageKey('custom-endpoint');
    if (trimmed) localStorage.setItem(id, trimmed);
    else localStorage.removeItem(id);
  } catch {
    /* ignore */
  }
}
