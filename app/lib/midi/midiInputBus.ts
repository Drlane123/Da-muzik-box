/**
 * Local hardware MIDI input bus (Web MIDI API → active screen route).
 * Mirrors Ableton/Cubase: Preferences pick a port; only the focused module hears notes.
 */

export type MidiNoteEvent = {
  type: 'noteOn' | 'noteOff';
  /** MIDI channel 0–15 (channel 9 = drums). */
  channel: number;
  note: number;
  velocity: number;
};

export type MidiInputRouteHandler = {
  onNoteOn?: (event: MidiNoteEvent) => void;
  onNoteOff?: (event: MidiNoteEvent) => void;
};

export const MIDI_INPUT_ROUTES = {
  beatLab: 'beat-lab',
  grooveLab: 'groove-lab',
  lab808: '808-lab',
  studioEditor2: 'studio-editor-2',
  vocalLab: 'vocal-lab',
  pianoRoll: 'piano-roll',
  masterArranger: 'master-arranger',
  aiPattern: 'ai-pattern',
  fallback: '__fallback__',
} as const;

export type MidiInputRouteId = (typeof MIDI_INPUT_ROUTES)[keyof typeof MIDI_INPUT_ROUTES];

const routes = new Map<string, MidiInputRouteHandler>();
let activeRouteId: string | null = null;
let fallbackHandler: MidiInputRouteHandler | null = null;

export function setActiveMidiInputRoute(id: string | null): void {
  activeRouteId = id;
}

export function getActiveMidiInputRoute(): string | null {
  return activeRouteId;
}

export function registerMidiInputRoute(id: string, handler: MidiInputRouteHandler): () => void {
  routes.set(id, handler);
  return () => {
    const cur = routes.get(id);
    if (cur === handler) routes.delete(id);
  };
}

export function setMidiInputFallback(handler: MidiInputRouteHandler | null): void {
  fallbackHandler = handler;
}

export function parseMidiBytes(data: Uint8Array): MidiNoteEvent | null {
  if (data.length < 2) return null;
  const status = data[0]!;
  const cmd = status & 0xf0;
  const channel = status & 0x0f;
  const note = data[1] ?? 0;
  const velRaw = data.length > 2 ? data[2]! : 127;

  if (cmd === 0x90) {
    if (velRaw === 0) return { type: 'noteOff', channel, note, velocity: 0 };
    return { type: 'noteOn', channel, note, velocity: velRaw };
  }
  if (cmd === 0x80) {
    return { type: 'noteOff', channel, note, velocity: velRaw };
  }
  return null;
}

export function dispatchMidiBytes(data: Uint8Array): boolean {
  const event = parseMidiBytes(data);
  if (!event) return false;

  const route = activeRouteId ? routes.get(activeRouteId) : null;
  if (route) {
    if (event.type === 'noteOn') route.onNoteOn?.(event);
    else route.onNoteOff?.(event);
    return true;
  }

  if (fallbackHandler) {
    if (event.type === 'noteOn') fallbackHandler.onNoteOn?.(event);
    else fallbackHandler.onNoteOff?.(event);
    return true;
  }

  return false;
}

/** GM drum note → Beat Lab pad index 0–15. */
const GM_DRUM_TO_MIXER_CH: Record<number, number> = {
  35: 17, 36: 17, 37: 2, 38: 1, 39: 2, 40: 1, 41: 7, 42: 4, 43: 7, 44: 4,
  45: 6, 46: 5, 47: 6, 48: 3, 49: 3, 50: 6, 51: 3, 52: 7, 53: 3, 55: 6, 57: 6,
};

export function midiDrumNoteToPadIndex(note: number): number {
  const mixerCh = GM_DRUM_TO_MIXER_CH[note];
  if (mixerCh != null) return Math.max(0, Math.min(15, mixerCh - 1));
  if (note >= 36 && note <= 51) return note - 36;
  return ((note % 16) + 16) % 16;
}
