/**
 * Studio Editor 2 — per-track MIDI channel helpers + optional hardware MIDI out.
 */

import {
  listSendEnabledOutputIds,
  requestMidiAccess,
  type MidiPortRoutingMap,
} from '@/app/lib/midi/midiDevices';

export type StudioEditor2MidiTrack = {
  kind: 'midi' | 'audio' | 'a2m' | 'rhythm' | 'glideBass' | 'synthGeno' | 'grooveLead' | 'genoUltraSynth' | 'genoBassSynth' | 'drumGenerator' | 'beatPads' | 'humCapture' | 'guitar' | 'genoChordCreator' | 'chordGenie' | 'lab808';
  midiChannel?: number;
};

export function studioTrackOutputsMidi(t: StudioEditor2MidiTrack | undefined): boolean {
  return (
    t?.kind === 'midi' ||
    t?.kind === 'a2m' ||
    t?.kind === 'rhythm' ||
    t?.kind === 'glideBass' ||
    t?.kind === 'synthGeno' ||
    t?.kind === 'grooveLead' ||
    t?.kind === 'genoUltraSynth' ||
    t?.kind === 'genoBassSynth' ||
    t?.kind === 'drumGenerator' ||
    t?.kind === 'beatPads' ||
    t?.kind === 'humCapture' ||
    t?.kind === 'guitar' ||
    t?.kind === 'genoChordCreator' ||
    t?.kind === 'chordGenie' ||
    t?.kind === 'lab808'
  );
}

/** Resolve 1–16 MIDI channel for an instrument track (explicit field or ordinal among MIDI lanes). */
export function studioMidiChannelForTrack(
  trackIndex: number,
  tracks: StudioEditor2MidiTrack[],
): number {
  const t = tracks[trackIndex];
  if (!t || !studioTrackOutputsMidi(t)) return 1;
  const explicit = t.midiChannel;
  if (typeof explicit === 'number' && explicit >= 1 && explicit <= 16) return explicit;
  let ord = 0;
  for (let i = 0; i <= trackIndex; i++) {
    if (studioTrackOutputsMidi(tracks[i])) ord += 1;
  }
  return Math.min(16, Math.max(1, ord));
}

/** Pick the next unused MIDI channel when adding an instrument track. */
export function studioNextMidiChannel(tracks: StudioEditor2MidiTrack[]): number {
  const used = new Set<number>();
  for (let i = 0; i < tracks.length; i++) {
    if (studioTrackOutputsMidi(tracks[i])) used.add(studioMidiChannelForTrack(i, tracks));
  }
  for (let ch = 1; ch <= 16; ch++) {
    if (!used.has(ch)) return ch;
  }
  return 16;
}

let cachedAccess: MIDIAccess | null = null;

export async function studioGetMidiAccess(): Promise<MIDIAccess | null> {
  if (cachedAccess) return cachedAccess;
  cachedAccess = await requestMidiAccess();
  return cachedAccess;
}

export function studioListHardwareMidiOutputs(
  access: MIDIAccess,
  routing: MidiPortRoutingMap,
): MIDIOutput[] {
  const ids = listSendEnabledOutputIds(access, routing);
  const outs: MIDIOutput[] = [];
  for (const id of ids) {
    const out = access.outputs.get(id);
    if (out) outs.push(out);
  }
  if (outs.length === 0) {
    const first = access.outputs.values().next();
    if (!first.done && Object.keys(routing).length === 0) outs.push(first.value);
  }
  return outs;
}

export function studioSendHardwareMidiNote(
  outputs: MIDIOutput[],
  channel1to16: number,
  pitch: number,
  velocity: number,
  noteOn: boolean,
  whenMs?: number,
): void {
  if (outputs.length === 0) return;
  const ch = (Math.max(1, Math.min(16, channel1to16)) - 1) & 0x0f;
  const vel = Math.max(0, Math.min(127, Math.round(velocity)));
  const bytes = noteOn ? [0x90 | ch, pitch & 0x7f, vel] : [0x80 | ch, pitch & 0x7f, 0];
  const when = whenMs !== undefined ? Math.max(performance.now(), whenMs) : undefined;
  for (const out of outputs) {
    try {
      if (when === undefined) out.send(bytes);
      else out.send(bytes, when);
    } catch {
      /* port disconnected */
    }
  }
}

export function studioScheduleHardwareMidiNote(
  outputs: MIDIOutput[],
  channel1to16: number,
  pitch: number,
  velocity: number,
  tOnMs: number,
  tOffMs: number,
): void {
  studioSendHardwareMidiNote(outputs, channel1to16, pitch, velocity, true, tOnMs);
  studioSendHardwareMidiNote(outputs, channel1to16, pitch, 0, false, Math.max(tOnMs + 8, tOffMs));
}
