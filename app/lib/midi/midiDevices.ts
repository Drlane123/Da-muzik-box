/**
 * Web MIDI external device enumeration (DAW Preferences → External Devices).
 */

export type MidiPortDirection = 'input' | 'output';

export type MidiExternalPort = {
  id: string;
  name: string;
  manufacturer: string;
  direction: MidiPortDirection;
  state: MIDIPortConnectionState;
};

export type MidiPortRouting = {
  receive: boolean;
  send: boolean;
};

export type MidiPortRoutingMap = Record<string, MidiPortRouting>;

export function listMidiExternalPorts(access: MIDIAccess): MidiExternalPort[] {
  const inputs: MidiExternalPort[] = [...access.inputs.values()].map((p) => ({
    id: p.id,
    name: p.name?.trim() || 'MIDI Input',
    manufacturer: p.manufacturer?.trim() || 'Unknown',
    direction: 'input',
    state: p.state,
  }));
  const outputs: MidiExternalPort[] = [...access.outputs.values()].map((p) => ({
    id: p.id,
    name: p.name?.trim() || 'MIDI Output',
    manufacturer: p.manufacturer?.trim() || 'Unknown',
    direction: 'output',
    state: p.state,
  }));
  return [...inputs, ...outputs];
}

export async function requestMidiAccess(): Promise<MIDIAccess | null> {
  if (typeof navigator === 'undefined' || !navigator.requestMIDIAccess) return null;
  try {
    return await navigator.requestMIDIAccess({ sysex: false });
  } catch {
    return null;
  }
}

export function resolvePortRouting(
  port: MidiExternalPort,
  routing: MidiPortRoutingMap,
  midiInputEnabled: boolean,
  legacyInputDeviceId: string,
): MidiPortRouting {
  const saved = routing[port.id];
  if (saved) return saved;
  if (port.direction === 'input') {
    const receive =
      midiInputEnabled &&
      (legacyInputDeviceId === 'all' || legacyInputDeviceId === port.id);
    return { receive, send: false };
  }
  return { receive: false, send: false };
}

export function isInputPortReceiveEnabled(
  portId: string,
  routing: MidiPortRoutingMap,
  midiInputEnabled: boolean,
  legacyInputDeviceId: string,
): boolean {
  if (!midiInputEnabled) return false;
  const saved = routing[portId];
  if (saved) return saved.receive;
  return legacyInputDeviceId === 'all' || legacyInputDeviceId === portId;
}

export function listSendEnabledOutputIds(
  access: MIDIAccess,
  routing: MidiPortRoutingMap,
): string[] {
  const ids: string[] = [];
  for (const output of access.outputs.values()) {
    if (routing[output.id]?.send === true) ids.push(output.id);
  }
  return ids;
}

export function portStatusLabel(state: MIDIPortConnectionState): string {
  return state === 'connected' ? 'Connected' : 'Disconnected';
}
